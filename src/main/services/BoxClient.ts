import { randomUUID } from 'node:crypto'
import type {
  AssistantMessage,
  Chat,
  ChatMessage,
  ChatMetadata,
  ChatStatus,
  LLMEvent,
  UserMessage
} from '../../shared/chat'
import type { Run, RunEventType } from '../../shared/run'
import type { WSEnvelope } from '../../shared/ws'

export type BoxTarget = { url: string; transport: 'lan' | 'remote' }

export type BoxClientDeps = {
  /** How to reach the paired box right now (LAN or tunnel), or null if unreachable. */
  resolveTarget: () => Promise<BoxTarget | null>
  /** The pairing `local_token` used to authenticate box HTTP calls. */
  getLocalToken: () => string | null
  /** Forward a box event to the renderer (and native notifications). */
  emit: (message: WSEnvelope) => void
}

// Bypasses ngrok's free-tier browser interstitial for programmatic requests.
const BOX_HEADERS = { 'ngrok-skip-browser-warning': 'true' } as const

// ---- Gateway REST/SSE shapes (server/gateway/schemas.py on the box) ----

interface GatewaySessionOut {
  id: string
  hermes_session_id: string
  title?: string | null
  status: string
  created_at: string
  updated_at: string
}

interface GatewayMessageOut {
  id: number
  session_id: string
  role: string
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

interface GatewayEventRow {
  id: number
  session_id: string
  hermes_session_id?: string | null
  type: string
  payload: Record<string, unknown>
  created_at: string
}

// server/gateway/routes.py `_MANIFEST_TO_GATEWAY_STATUS` values.
const GATEWAY_STATUS_TO_CHAT_STATUS: Record<string, ChatStatus> = {
  idle: 'idle',
  running: 'streaming',
  failed: 'error'
}

const isoToMs = (iso: string): number => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : Date.now()
}

interface RunTracker {
  runId: string
  sequence: number
}

/** One live `GET /sessions/{id}/events` subscription plus its translation state. */
interface SessionSubscription {
  sessionId: string
  localId: string
  controller: AbortController
  /** turnIds queued by `chat.submit`, consumed in order as `assistant.started` arrives. */
  pendingTurnIds: string[]
  activeRun: RunTracker | null
  closed: boolean
}

/**
 * HTTP + SSE client for the box's `/sessions` gateway API.
 *
 * The renderer still speaks the old socket surface — a {@link WSEnvelope} in
 * via {@link send}, {@link WSEnvelope}s back out via `emit` — so all the
 * gateway-specific plumbing (session bookkeeping, per-session event streams,
 * assistant.x / tool.x / error -> run.accepted/run.event translation) lives
 * here. See the class-level comments below for the two id spaces this
 * juggles.
 *
 * Local chat ids vs. box session ids
 * -----------------------------------
 * The renderer creates a chat with a locally-generated uuid (`chat.id`)
 * before the box knows anything about it. The gateway only understands
 * sessions it created itself (`POST /sessions` -> `SessionOut.id`). To keep
 * the renderer's `chat.id` stable across a run (`SocketSyncProvider` drops
 * `run.event`s whose `chatId` doesn't match the open chat), this class:
 *  - maps `localId -> sessionId` the first time a fresh local chat is
 *    submitted (creating the session lazily), and
 *  - identity-maps `sessionId -> sessionId` the first time a *pre-existing*
 *    box session is touched via chat-history (nothing else knows a "local
 *    id" for those, so the session id doubles as the local id).
 * Every outgoing envelope uses the local id; every gateway payload is looked
 * up back to it before translation.
 */
export class BoxClient {
  private readonly sessionIdByLocalId = new Map<string, string>()
  private readonly localIdBySessionId = new Map<string, string>()
  // Live progress for background Pi jobs (pi.* events). Each job gets its own
  // synthesized run so its activity streams as a "Pi working…" message,
  // separate from the assistant turn that launched it (which has already ended).
  private readonly piRuns = new Map<string, { runId: string; chatId: string; sequence: number }>()
  private readonly subscriptions = new Map<string, SessionSubscription>()

  constructor(private readonly deps: BoxClientDeps) {}

  private async boxFetch(path: string, init?: RequestInit): Promise<Response | null> {
    const target = await this.deps.resolveTarget()
    if (!target) return null
    const token = this.deps.getLocalToken()
    try {
      return await fetch(`${target.url}${path}`, {
        ...init,
        headers: {
          ...BOX_HEADERS,
          ...(init?.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
    } catch {
      // Box unreachable on this path (offline / tunnel down).
      return null
    }
  }

  /** Handle one outbound message from the renderer. */
  async send(envelope: WSEnvelope): Promise<void> {
    try {
      switch (envelope.type) {
        case 'chat-history':
          return await this.handleChatHistory(envelope.data)
        case 'notification.list':
          return await this.handleNotificationList()
        case 'notification.dismiss':
          return await this.handleNotificationDismiss()
        case 'cron.upcoming.list':
          return await this.handleCronUpcoming()
        case 'chat':
        case 'chat.submit':
          return await this.handleChat(envelope)
        case 'run.stop':
          return await this.handleRunStop(envelope.data)
        default:
          console.warn(`[box] unhandled message type: ${envelope.type}`)
      }
    } catch (error) {
      console.error(`[box] send(${envelope.type}) failed`, error)
    }
  }

  // ---- session <-> local id bookkeeping ----

  private linkSession(localId: string, sessionId: string): void {
    this.sessionIdByLocalId.set(localId, sessionId)
    this.localIdBySessionId.set(sessionId, localId)
  }

  private localIdFor(sessionId: string): string {
    return this.localIdBySessionId.get(sessionId) ?? sessionId
  }

  /** Create (or reuse) the box session backing a local chat id. */
  private async ensureSession(localId: string, titleHint?: string): Promise<string | null> {
    const existing = this.sessionIdByLocalId.get(localId)
    if (existing) return existing

    const res = await this.boxFetch('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleHint ?? null })
    })
    if (!res || !res.ok) return null
    let session: GatewaySessionOut
    try {
      session = (await res.json()) as GatewaySessionOut
    } catch {
      return null
    }
    this.linkSession(localId, session.id)
    return session.id
  }

  // ---- chat-history: GET /sessions, GET /sessions/{id}(/messages) ----

  private async handleChatHistory(data: unknown): Promise<void> {
    const chatId = typeof data === 'string' ? data : null
    if (!chatId) {
      await this.handleChatHistoryList()
      return
    }
    await this.handleChatHistoryOne(chatId)
  }

  private async handleChatHistoryList(): Promise<void> {
    const res = await this.boxFetch('/sessions')
    if (!res || !res.ok) {
      this.deps.emit({ type: 'chat-history', data: [] })
      return
    }
    let sessions: GatewaySessionOut[]
    try {
      sessions = (await res.json()) as GatewaySessionOut[]
    } catch {
      this.deps.emit({ type: 'chat-history', data: [] })
      return
    }
    const metadata: ChatMetadata[] = sessions.map((session) => {
      if (!this.localIdBySessionId.has(session.id)) {
        this.linkSession(session.id, session.id)
      }
      return {
        id: this.localIdFor(session.id),
        title: session.title ?? undefined,
        createdAt: isoToMs(session.created_at),
        updatedAt: isoToMs(session.updated_at),
        status: GATEWAY_STATUS_TO_CHAT_STATUS[session.status] ?? 'idle'
      }
    })
    this.deps.emit({ type: 'chat-history', data: metadata })
  }

  private async handleChatHistoryOne(localOrSessionId: string): Promise<void> {
    const sessionId = this.sessionIdByLocalId.get(localOrSessionId) ?? localOrSessionId
    const [sessionRes, messagesRes] = await Promise.all([
      this.boxFetch(`/sessions/${encodeURIComponent(sessionId)}`),
      this.boxFetch(`/sessions/${encodeURIComponent(sessionId)}/messages`)
    ])
    if (!sessionRes || !sessionRes.ok || !messagesRes || !messagesRes.ok) {
      this.deps.emit({ type: 'chat-history', data: null })
      return
    }
    let session: GatewaySessionOut
    let messages: GatewayMessageOut[]
    try {
      session = (await sessionRes.json()) as GatewaySessionOut
      messages = (await messagesRes.json()) as GatewayMessageOut[]
    } catch {
      this.deps.emit({ type: 'chat-history', data: null })
      return
    }
    if (!this.localIdBySessionId.has(session.id)) {
      this.linkSession(localOrSessionId, session.id)
    }
    const localId = this.localIdFor(session.id)

    const chat: Chat = {
      id: localId,
      title: session.title ?? undefined,
      createdAt: isoToMs(session.created_at),
      updatedAt: isoToMs(session.updated_at),
      status: GATEWAY_STATUS_TO_CHAT_STATUS[session.status] ?? 'idle',
      messages: messages.map((message) => this.gatewayMessageToChatMessage(message))
    }
    this.deps.emit({ type: 'chat-history', data: chat })
  }

  /**
   * The gateway's `/messages` route only returns finished content (no
   * per-token events), so a historical assistant turn is represented as a
   * single synthetic `token` event carrying the full text — `Message.tsx`
   * just concatenates `token` events for display, so this renders correctly.
   */
  private gatewayMessageToChatMessage(message: GatewayMessageOut): ChatMessage {
    const createdAt = isoToMs(message.created_at)
    if (message.role === 'user') {
      const userMessage: UserMessage = {
        id: `msg-${message.id}`,
        createdAt,
        updatedAt: createdAt,
        status: 'complete',
        role: 'user',
        content: message.content,
        attachments: []
      }
      return userMessage
    }

    const events: LLMEvent[] = message.content
      ? [{ id: `${message.id}:0`, createdAt, type: 'token', value: message.content }]
      : []
    const runId = message.metadata?.run_id
    const assistantMessage: AssistantMessage = {
      id: `msg-${message.id}`,
      createdAt,
      updatedAt: createdAt,
      status: 'complete',
      role: 'assistant',
      runId: typeof runId === 'string' ? runId : undefined,
      events
    }
    return assistantMessage
  }

  // ---- notifications / crons: NOT backed by the gateway ----
  //
  // server/gateway/routes.py exposes no /notifications or /crons routes (that
  // was retired-API surface only). Per the migration plan, these are stubbed
  // to empty responses rather than adding routes to the box. `start()` below
  // also drops the old 5s notification poll since there's nothing to poll.

  private async handleNotificationList(): Promise<void> {
    this.deps.emit({ type: 'notification.list', data: { notifications: [] } })
  }

  private async handleCronUpcoming(): Promise<void> {
    this.deps.emit({ type: 'cron.upcoming.list', data: { crons: [] } })
  }

  private async handleNotificationDismiss(): Promise<void> {
    // No-op: no notifications backend to dismiss against.
  }

  // ---- chat turns: POST /sessions/{id}/messages + the events SSE stream ----

  private async handleChat(envelope: WSEnvelope): Promise<void> {
    let chat: Chat | null = null
    let turnId: string | null = null

    if (
      envelope.type === 'chat.submit' &&
      envelope.data &&
      typeof envelope.data === 'object' &&
      'chat' in envelope.data
    ) {
      const data = envelope.data as { chat: Chat; turnId?: unknown }
      chat = data.chat
      turnId = typeof data.turnId === 'string' ? data.turnId : null
    } else if (
      envelope.type === 'chat' &&
      envelope.data &&
      typeof envelope.data === 'object' &&
      'id' in envelope.data &&
      'messages' in envelope.data
    ) {
      chat = envelope.data as Chat
    }
    if (!chat) return

    const lastUserMessage = [...chat.messages]
      .reverse()
      .find((message): message is UserMessage => message.role === 'user')
    if (!lastUserMessage) return

    const sessionId = await this.ensureSession(chat.id, chat.title)
    if (!sessionId) {
      this.emitSubmitFailure(chat.id, turnId)
      return
    }

    await this.ensureSubscription(sessionId)
    const sub = this.subscriptions.get(sessionId)
    if (turnId) sub?.pendingTurnIds.push(turnId)

    const res = await this.boxFetch(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: lastUserMessage.content })
    })
    if (!res || !res.ok) {
      if (turnId && sub) {
        const idx = sub.pendingTurnIds.indexOf(turnId)
        if (idx !== -1) sub.pendingTurnIds.splice(idx, 1)
      }
      this.emitSubmitFailure(chat.id, turnId)
    }
  }

  private emitSubmitFailure(chatId: string, turnId: string | null): void {
    const runId = randomUUID()
    const now = Date.now()
    const run: Run = {
      id: runId,
      kind: 'chat',
      status: 'error',
      createdAt: now,
      updatedAt: now,
      chatId,
      sourceId: null,
      turnId
    }
    this.deps.emit({ type: 'run.accepted', data: run })
    this.deps.emit({
      type: 'run.event',
      data: {
        runId,
        sequence: 0,
        createdAt: now,
        chatId,
        event: { type: 'error', data: { error: 'Failed to reach box.' } }
      }
    })
  }

  private emitPiToken(jobId: string, createdAt: number, text: string): void {
    const state = this.piRuns.get(jobId)
    if (!state) return
    this.deps.emit({
      type: 'run.event',
      data: {
        runId: state.runId,
        sequence: state.sequence++,
        createdAt,
        chatId: state.chatId,
        event: { type: 'token', data: { value: text } }
      }
    })
  }

  /** One human-readable line for a pi.progress event, or null to skip it.
   * Pi emits normalized RPC activity rather than the old command/file phases,
   * so render tool starts and completed assistant messages while suppressing
   * cumulative tool updates/results. */
  private formatPiProgress(payload: Record<string, unknown>): string | null {
    if (payload.kind === 'tool_update' || payload.kind === 'tool_end') return null

    if (payload.kind === 'message') {
      const detail = payload.detail
      if (typeof detail === 'string') return detail ? `${detail.slice(0, 500)}\n` : null
      if (detail && typeof detail === 'object' && 'content' in detail) {
        const content = (detail as { content?: unknown }).content
        if (typeof content === 'string') return content ? `${content.slice(0, 500)}\n` : null
        if (Array.isArray(content)) {
          const text = content
            .map((block) =>
              block &&
              typeof block === 'object' &&
              'text' in block &&
              typeof block.text === 'string'
                ? block.text
                : ''
            )
            .join('')
          return text ? `${text.slice(0, 500)}\n` : null
        }
      }
      return null
    }

    if (payload.kind === 'tool_start') {
      const tool = typeof payload.tool_name === 'string' ? payload.tool_name : 'tool'
      const input = payload.input
      let detail = ''
      if (input && typeof input === 'object') {
        const args = input as Record<string, unknown>
        const preferred = args.command ?? args.path ?? args.slug ?? args.pattern
        detail = typeof preferred === 'string' ? preferred : JSON.stringify(args)
      } else if (typeof input === 'string') {
        detail = input
      }
      detail = detail.slice(0, 200)
      if (tool === 'bash') return detail ? `$ ${detail}\n` : '$ bash\n'
      if (tool === 'edit' || tool === 'write') return `✏️  ${tool}${detail ? `: ${detail}` : ''}\n`
      if (tool === 'deploy') return `🚀 deploy${detail ? `: ${detail}` : ''}\n`
      return `🔍 ${tool}${detail ? `: ${detail}` : ''}\n`
    }

    const detail = payload.detail
    if (typeof detail === 'string' && detail) {
      return `${detail.slice(0, 200)}\n`
    }
    return null
  }

  private async handleRunStop(data: unknown): Promise<void> {
    const runId =
      data && typeof data === 'object' && 'runId' in data
        ? (data as { runId?: unknown }).runId
        : undefined
    if (typeof runId !== 'string') return
    for (const sub of this.subscriptions.values()) {
      if (sub.activeRun?.runId === runId) {
        await this.boxFetch(`/sessions/${encodeURIComponent(sub.sessionId)}/interrupt`, {
          method: 'POST'
        })
        return
      }
    }
  }

  // ---- per-session events SSE (GET /sessions/{id}/events) ----

  private async ensureSubscription(sessionId: string): Promise<void> {
    const existing = this.subscriptions.get(sessionId)
    if (existing && !existing.closed) return

    if (!this.localIdBySessionId.has(sessionId)) {
      this.linkSession(sessionId, sessionId)
    }
    const localId = this.localIdFor(sessionId)

    const cursor = await this.latestEventId(sessionId)
    const controller = new AbortController()
    const sub: SessionSubscription = {
      sessionId,
      localId,
      controller,
      pendingTurnIds: [],
      activeRun: null,
      closed: false
    }
    this.subscriptions.set(sessionId, sub)

    const res = await this.boxFetch(
      `/sessions/${encodeURIComponent(sessionId)}/events?after=${cursor}`,
      { signal: controller.signal }
    )
    if (!res || !res.ok || !res.body) {
      sub.closed = true
      this.subscriptions.delete(sessionId)
      return
    }
    void this.consumeEventStream(sub, res.body)
  }

  /**
   * Skip replaying history the caller already has (from `/messages`) by
   * starting the live stream just past the newest event currently on record.
   * `limit=500` bounds the lookup; if a session has more backlog than that
   * the cursor undercounts and a handful of already-known events would be
   * re-translated — acceptable since `chat-history` already rendered them
   * from `/messages`, not from this stream.
   */
  private async latestEventId(sessionId: string): Promise<number> {
    const res = await this.boxFetch(
      `/sessions/${encodeURIComponent(sessionId)}/events/history?after=0&limit=500`
    )
    if (!res || !res.ok) return 0
    try {
      const rows = (await res.json()) as GatewayEventRow[]
      return rows.reduce((max, row) => Math.max(max, row.id), 0)
    } catch {
      return 0
    }
  }

  private async consumeEventStream(
    sub: SessionSubscription,
    stream: ReadableStream<Uint8Array>
  ): Promise<void> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          this.dispatchEventFrame(sub, buffer.slice(0, sep))
          buffer = buffer.slice(sep + 2)
        }
      }
    } catch {
      // Aborted via stop()/interrupt, or the connection dropped. Either way
      // there's nothing more to read; a future chat.submit on this session
      // will call ensureSubscription() again and reconnect.
    } finally {
      this.subscriptions.delete(sub.sessionId)
      sub.closed = true
    }
  }

  private dispatchEventFrame(sub: SessionSubscription, frame: string): void {
    // Each SSE frame is `id: <n>\nevent: <type>\ndata: <json>\n\n` (or a
    // `: keepalive` comment line). The `data:` line's JSON already contains
    // id/type/payload, so the `id:`/`event:` header lines are redundant for
    // our purposes and can be ignored.
    const dataLine = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n')
    if (!dataLine) return
    let row: GatewayEventRow
    try {
      row = JSON.parse(dataLine) as GatewayEventRow
    } catch {
      return
    }
    this.handleGatewayEvent(sub, row)
  }

  /**
   * The crux of the gateway migration: translate the box's session-scoped
   * `assistant.*`/`tool.*`/`error` events (server/gateway/translate.py) into
   * the `run.accepted`/`run.event` shapes `runEventToChatEvent` expects. The
   * gateway has no concept of a "run" on the wire (it's flattened into a flat
   * per-session event log), so a runId is synthesized client-side per
   * assistant turn and threaded through the events belonging to it.
   */
  private handleGatewayEvent(sub: SessionSubscription, row: GatewayEventRow): void {
    const chatId = sub.localId
    const createdAt = isoToMs(row.created_at)
    const payload = row.payload ?? {}

    switch (row.type) {
      case 'session.created':
      case 'user.message':
        // Already reflected locally (optimistic user message / session
        // creation echo) — nothing new for the renderer here.
        return

      case 'assistant.started':
        this.startRun(sub, chatId, createdAt)
        return

      case 'assistant.delta': {
        const text = payload.text
        if (typeof text !== 'string') return
        this.ensureActiveRun(sub, chatId, createdAt)
        this.emitRunEvent(sub, chatId, createdAt, 'token', { value: text })
        return
      }

      case 'assistant.completed': {
        this.ensureActiveRun(sub, chatId, createdAt)
        if (payload.raw_type === 'cancelled') {
          this.emitRunEvent(sub, chatId, createdAt, 'cancelled', {
            reason: typeof payload.reason === 'string' ? payload.reason : 'Run stopped by user.'
          })
        } else {
          this.emitRunEvent(sub, chatId, createdAt, 'completed', null)
        }
        sub.activeRun = null
        return
      }

      case 'tool.started':
        this.ensureActiveRun(sub, chatId, createdAt)
        this.emitRunEvent(sub, chatId, createdAt, 'tool_call_start', {
          toolCallId: payload.tool_id,
          toolName: payload.name,
          input: payload.args
        })
        return

      case 'tool.completed':
        this.ensureActiveRun(sub, chatId, createdAt)
        this.emitRunEvent(sub, chatId, createdAt, 'tool_call_end', {
          toolCallId: payload.tool_id,
          toolName: payload.name,
          output: payload.result
        })
        return

      case 'tool.progress':
        this.ensureActiveRun(sub, chatId, createdAt)
        this.emitRunEvent(sub, chatId, createdAt, 'progress', {
          toolCallId: payload.tool_id,
          toolName: payload.name,
          context: payload.context
        })
        return

      case 'pi.started': {
        const jobId = typeof payload.job_id === 'string' ? payload.job_id : null
        if (!jobId) return
        const runId = randomUUID()
        this.piRuns.set(jobId, { runId, chatId, sequence: 0 })
        const run: Run = {
          id: runId,
          kind: 'chat',
          status: 'running',
          createdAt,
          updatedAt: createdAt,
          chatId,
          sourceId: null,
          turnId: null
        }
        this.deps.emit({ type: 'run.accepted', data: run })
        this.emitPiToken(jobId, createdAt, '🛠️  Pi is working…\n')
        return
      }

      case 'pi.progress': {
        const jobId = typeof payload.job_id === 'string' ? payload.job_id : null
        if (jobId) {
          const line = this.formatPiProgress(payload)
          if (line) this.emitPiToken(jobId, createdAt, line)
        }
        return
      }

      case 'pi.completed': {
        const jobId = typeof payload.job_id === 'string' ? payload.job_id : null
        if (!jobId) return
        const done = payload.status === 'done'
        const stopped = payload.status === 'stopped'
        const detail = done
          ? typeof payload.result === 'string'
            ? payload.result.slice(0, 300)
            : ''
          : typeof payload.error === 'string'
            ? payload.error
            : stopped
              ? 'stopped by request'
              : 'unknown error'
        this.emitPiToken(
          jobId,
          createdAt,
          done
            ? `\n✅ Pi finished. ${detail}\n`
            : stopped
              ? `\n⏹️ Pi stopped: ${detail}\n`
              : `\n❌ Pi failed: ${detail}\n`
        )
        const state = this.piRuns.get(jobId)
        if (state) {
          const terminalEvent = done
            ? { type: 'completed' as const, data: null }
            : stopped
              ? { type: 'cancelled' as const, data: { reason: detail } }
              : { type: 'error' as const, data: { error: detail } }
          this.deps.emit({
            type: 'run.event',
            data: {
              runId: state.runId,
              sequence: state.sequence++,
              createdAt,
              chatId,
              event: terminalEvent
            }
          })
          this.piRuns.delete(jobId)
        }
        return
      }

      case 'error':
        this.ensureActiveRun(sub, chatId, createdAt)
        this.emitRunEvent(sub, chatId, createdAt, 'error', {
          error: typeof payload.message === 'string' ? payload.message : 'Run failed.'
        })
        sub.activeRun = null
        return

      case 'chat': {
        // Not currently published anywhere in server/gateway/{routes,bus,
        // translate}.py — grepped the box and only session.created/
        // user.message are published outside ChatRunEventTranslator, which
        // itself never emits "chat". Kept as a defensive, best-effort
        // fallback: if a future/legacy path pushes a fully-formed message
        // under this type, surface its text as a one-shot completed turn
        // instead of silently dropping it.
        const text =
          typeof payload.text === 'string'
            ? payload.text
            : typeof payload.content === 'string'
              ? payload.content
              : null
        if (text === null) return
        this.ensureActiveRun(sub, chatId, createdAt)
        this.emitRunEvent(sub, chatId, createdAt, 'token', { value: text })
        this.emitRunEvent(sub, chatId, createdAt, 'completed', null)
        sub.activeRun = null
        return
      }

      default:
        console.warn(`[box] unhandled gateway event type: ${row.type}`)
    }
  }

  private startRun(sub: SessionSubscription, chatId: string, createdAt: number): void {
    const turnId = sub.pendingTurnIds.shift() ?? null
    const runId = randomUUID()
    sub.activeRun = { runId, sequence: 0 }
    const run: Run = {
      id: runId,
      kind: 'chat',
      status: 'running',
      createdAt,
      updatedAt: createdAt,
      chatId,
      sourceId: null,
      turnId
    }
    this.deps.emit({ type: 'run.accepted', data: run })
    this.emitRunEvent(sub, chatId, createdAt, 'started', null)
  }

  /**
   * Defensive: a delta/tool/error event arrived without a preceding
   * `assistant.started` (e.g. this client attached mid-run via
   * chat-history). Synthesize the run so there's still somewhere for these
   * events to bind.
   */
  private ensureActiveRun(sub: SessionSubscription, chatId: string, createdAt: number): void {
    if (sub.activeRun) return
    this.startRun(sub, chatId, createdAt)
  }

  private emitRunEvent(
    sub: SessionSubscription,
    chatId: string,
    createdAt: number,
    type: RunEventType,
    data: Record<string, unknown> | null
  ): void {
    const run = sub.activeRun
    if (!run) return
    const sequence = run.sequence++
    this.deps.emit({
      type: 'run.event',
      data: { runId: run.runId, sequence, createdAt, chatId, event: { type, data } }
    })
  }

  /**
   * Historically started the notification poller. The gateway has no
   * notifications backend, so there's nothing to poll — kept as a no-op so
   * main/index.ts's pairing lifecycle (`startBoxClient()` on ready/pair)
   * doesn't need to change.
   */
  start(): void {
    // Intentionally empty — see the class comment above.
  }

  /** Abort all live event subscriptions and reset session bookkeeping (e.g. on unpair/quit). */
  stop(): void {
    for (const sub of this.subscriptions.values()) {
      sub.closed = true
      sub.controller.abort()
    }
    this.subscriptions.clear()
    this.sessionIdByLocalId.clear()
    this.localIdBySessionId.clear()
  }
}
