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
import type { CodexInputQuestion, WSEnvelope } from '../../shared/ws'

export type BoxTarget = { url: string; transport: 'lan' }

export type BoxClientDeps = {
  /** How to reach the directly configured or discovered box. */
  resolveTarget: () => Promise<BoxTarget | null>
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
  type: string
  seq: number
  time: number
  data: Record<string, unknown>
  ignorable?: boolean
  sourceEventSeqs?: number[]
  surfaceOp?: unknown
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
  visibleTextLength: number
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
 * canonical Session events -> run.accepted/run.event translation) lives
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
  // Live progress for background Codex jobs (codex.* events). Each job gets its
  // own synthesized run so its activity streams as a "Codex working…" message,
  // separate from the assistant turn that launched it (which has already ended).
  private readonly codexRuns = new Map<
    string,
    { runId: string; chatId: string; sessionId: string; sequence: number }
  >()
  private readonly subscriptions = new Map<string, SessionSubscription>()

  constructor(private readonly deps: BoxClientDeps) {}

  private async boxFetch(path: string, init?: RequestInit): Promise<Response | null> {
    const target = await this.deps.resolveTarget()
    if (!target) return null
    try {
      return await fetch(`${target.url}${path}`, {
        ...init,
        headers: {
          ...BOX_HEADERS,
          ...(init?.headers ?? {})
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
        case 'codex.input.submit':
          return await this.handleCodexInputSubmit(envelope.data)
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
      body: JSON.stringify({
        title: titleHint ?? null,
        cwd: process.env.AIOS_BOX_CWD?.trim() || null
      })
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
    await this.ensureSubscription(session.id)

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

  private emitCodexToken(jobId: string, createdAt: number, text: string): void {
    const state = this.codexRuns.get(jobId)
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

  /** One human-readable line for a codex.progress event, or null to skip it.
   * Surfaces command/file starts + Codex's own messages; skips the tool_end
   * (output) phase so the feed stays clean. */
  private formatCodexProgress(payload: Record<string, unknown>): string | null {
    if (payload.phase === 'tool_end') return null
    const detail = typeof payload.detail === 'string' ? payload.detail.slice(0, 200) : ''
    if (!detail) return null
    switch (payload.kind) {
      case 'command':
        return `$ ${detail}\n`
      case 'file':
        return `✏️  ${detail}\n`
      default:
        return `${detail}\n` // message
    }
  }

  private async handleRunStop(data: unknown): Promise<void> {
    const runId =
      data && typeof data === 'object' && 'runId' in data
        ? (data as { runId?: unknown }).runId
        : undefined
    if (typeof runId !== 'string') return
    for (const [jobId, codexRun] of this.codexRuns) {
      if (codexRun.runId === runId) {
        await this.boxFetch(
          `/sessions/${encodeURIComponent(codexRun.sessionId)}/codex-jobs/${encodeURIComponent(jobId)}/cancel`,
          { method: 'POST' }
        )
        return
      }
    }
    for (const sub of this.subscriptions.values()) {
      if (sub.activeRun?.runId === runId) {
        await this.boxFetch(`/sessions/${encodeURIComponent(sub.sessionId)}/interrupt`, {
          method: 'POST'
        })
        return
      }
    }
  }

  private async handleCodexInputSubmit(data: unknown): Promise<void> {
    if (!data || typeof data !== 'object') return
    const value = data as {
      jobId?: unknown
      chatId?: unknown
      answers?: unknown
    }
    if (
      typeof value.jobId !== 'string' ||
      typeof value.chatId !== 'string' ||
      !value.answers ||
      typeof value.answers !== 'object'
    ) {
      return
    }
    const sessionId = this.sessionIdByLocalId.get(value.chatId)
    if (!sessionId) return
    const res = await this.boxFetch(
      `/sessions/${encodeURIComponent(sessionId)}/codex-jobs/${encodeURIComponent(value.jobId)}/answers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: value.answers })
      }
    )
    if (res?.ok) return
    let error = 'Failed to send your answer to Codex.'
    try {
      const body = (await res?.json()) as { detail?: unknown }
      if (typeof body?.detail === 'string') error = body.detail
    } catch {
      // Keep the stable fallback for network/non-JSON failures.
    }
    this.deps.emit({
      type: 'codex.input.failed',
      data: { jobId: value.jobId, chatId: value.chatId, error }
    })
  }

  private parseCodexQuestions(payload: Record<string, unknown>): CodexInputQuestion[] {
    if (!Array.isArray(payload.questions)) return []
    return payload.questions.flatMap((question) => {
      if (!question || typeof question !== 'object') return []
      const value = question as Record<string, unknown>
      if (typeof value.id !== 'string' || typeof value.question !== 'string') return []
      const options = Array.isArray(value.options)
        ? value.options.flatMap((option) => {
            if (!option || typeof option !== 'object') return []
            const candidate = option as Record<string, unknown>
            return typeof candidate.label === 'string'
              ? [
                  {
                    label: candidate.label,
                    description:
                      typeof candidate.description === 'string' ? candidate.description : ''
                  }
                ]
              : []
          })
        : null
      return [
        {
          id: value.id,
          header: typeof value.header === 'string' ? value.header : 'Codex question',
          question: value.question,
          isOther: value.isOther === true || value.is_other === true,
          isSecret: value.isSecret === true || value.is_secret === true,
          options
        }
      ]
    })
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
   * History is paged so long-running chats do not reconnect from an old cursor
   * and replay thousands of already-rendered events.
   */
  private async latestEventId(sessionId: string): Promise<number> {
    let cursor = -1
    for (;;) {
      const res = await this.boxFetch(
        `/sessions/${encodeURIComponent(sessionId)}/events/history?after=${cursor}&limit=500`
      )
      if (!res || !res.ok) return cursor
      try {
        const rows = (await res.json()) as GatewayEventRow[]
        const nextCursor = rows.reduce((max, row) => Math.max(max, row.seq), cursor)
        if (rows.length < 500 || nextCursor === cursor) return nextCursor
        cursor = nextCursor
      } catch {
        return cursor
      }
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
    // Each SSE frame is `id: <seq>\nevent: <type>\ndata: <json>\n\n` (or a
    // `: keepalive` comment line). The `data:` line's JSON already contains
    // seq/type/data, so the `id:`/`event:` header lines are redundant for
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
   * Translate LotusOS's canonical, lossless Session log into the legacy
   * `run.accepted`/`run.event` surface the renderer consumes. A runId is
   * synthesized client-side for each canonical turn.
   */
  private handleGatewayEvent(sub: SessionSubscription, row: GatewayEventRow): void {
    const chatId = sub.localId
    const createdAt = Number.isFinite(row.time) ? row.time : Date.now()
    const payload = row.data ?? {}

    switch (row.type) {
      case 'user/message':
        // Already reflected locally (optimistic user message / session
        // creation echo) — nothing new for the renderer here.
        return

      case 'turn/start':
        this.startRun(sub, chatId, createdAt)
        return

      case 'assistant/chunk': {
        const chunk = payload.chunk
        if (!chunk || typeof chunk !== 'object') return
        const value = chunk as Record<string, unknown>
        if (value.type !== 'text-delta') return
        const text = value.text
        if (typeof text !== 'string') return
        this.ensureActiveRun(sub, chatId, createdAt)
        this.emitRunEvent(sub, chatId, createdAt, 'token', { value: text })
        if (sub.activeRun) sub.activeRun.visibleTextLength += text.length
        return
      }

      case 'assistant/message': {
        this.ensureActiveRun(sub, chatId, createdAt)
        if (sub.activeRun?.visibleTextLength === 0) {
          const message = payload.message
          const text = this.visibleText(
            message && typeof message === 'object'
              ? (message as Record<string, unknown>).content
              : undefined
          )
          if (text) {
            this.emitRunEvent(sub, chatId, createdAt, 'token', { value: text })
            if (sub.activeRun) sub.activeRun.visibleTextLength += text.length
          }
        }
        return
      }

      case 'tool/call':
        this.ensureActiveRun(sub, chatId, createdAt)
        this.emitRunEvent(sub, chatId, createdAt, 'tool_call_start', {
          toolCallId: payload.callId,
          toolName: payload.name,
          input: this.parseToolArguments(payload.arguments)
        })
        return

      case 'tool/result': {
        this.ensureActiveRun(sub, chatId, createdAt)
        const message =
          payload.message && typeof payload.message === 'object'
            ? (payload.message as Record<string, unknown>)
            : {}
        this.emitRunEvent(sub, chatId, createdAt, 'tool_call_end', {
          toolCallId: message.toolCallId,
          output: message.content,
          isError: message.isError === true
        })
        return
      }

      case 'turn/end': {
        this.ensureActiveRun(sub, chatId, createdAt)
        const reason =
          payload.reason && typeof payload.reason === 'object'
            ? (payload.reason as Record<string, unknown>)
            : {}
        if (reason.kind === 'aborted' || reason.kind === 'interrupted') {
          this.emitRunEvent(sub, chatId, createdAt, 'cancelled', {
            reason: 'Run stopped before completion.'
          })
        } else if (reason.kind === 'error' || reason.kind === 'blocked') {
          const failure =
            reason.error && typeof reason.error === 'object'
              ? (reason.error as Record<string, unknown>)
              : {}
          this.emitRunEvent(sub, chatId, createdAt, 'error', {
            error: typeof failure.message === 'string' ? failure.message : `Run ended: ${String(reason.kind)}`
          })
        } else {
          this.emitRunEvent(sub, chatId, createdAt, 'completed', null)
        }
        sub.activeRun = null
        return
      }

      case 'codex.started': {
        const jobId = typeof payload.job_id === 'string' ? payload.job_id : null
        if (!jobId) return
        const runId = randomUUID()
        this.codexRuns.set(jobId, { runId, chatId, sessionId: sub.sessionId, sequence: 0 })
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
        this.emitCodexToken(jobId, createdAt, '🛠️  Codex is building your app…\n')
        return
      }

      case 'codex.progress': {
        const jobId = typeof payload.job_id === 'string' ? payload.job_id : null
        if (jobId) {
          const line = this.formatCodexProgress(payload)
          if (line) this.emitCodexToken(jobId, createdAt, line)
        }
        return
      }

      case 'codex.input.requested': {
        const jobId = typeof payload.job_id === 'string' ? payload.job_id : null
        if (!jobId) return
        if (!this.codexRuns.has(jobId)) {
          const runId = randomUUID()
          this.codexRuns.set(jobId, {
            runId,
            chatId,
            sessionId: sub.sessionId,
            sequence: 0
          })
          this.deps.emit({
            type: 'run.accepted',
            data: {
              id: runId,
              kind: 'chat',
              status: 'running',
              createdAt,
              updatedAt: createdAt,
              chatId,
              sourceId: null,
              turnId: null
            }
          })
        }
        this.emitCodexToken(jobId, createdAt, '\nCodex needs your input to continue.\n')
        this.deps.emit({
          type: 'codex.input.requested',
          data: {
            jobId,
            chatId,
            itemId: typeof payload.item_id === 'string' ? payload.item_id : null,
            questions: this.parseCodexQuestions(payload)
          }
        })
        return
      }

      case 'codex.input.resolved': {
        const jobId = typeof payload.job_id === 'string' ? payload.job_id : null
        if (!jobId) return
        this.emitCodexToken(jobId, createdAt, '\nThanks — Codex is continuing…\n')
        this.deps.emit({ type: 'codex.input.resolved', data: { jobId, chatId } })
        return
      }

      case 'codex.completed': {
        const jobId = typeof payload.job_id === 'string' ? payload.job_id : null
        if (!jobId) return
        this.deps.emit({ type: 'codex.input.resolved', data: { jobId, chatId } })
        const done = payload.status === 'done'
        const detail = done
          ? typeof payload.result === 'string'
            ? payload.result.slice(0, 300)
            : ''
          : typeof payload.error === 'string'
            ? payload.error
            : 'unknown error'
        this.emitCodexToken(
          jobId,
          createdAt,
          done ? `\n✅ Codex finished. ${detail}\n` : `\n❌ Codex failed: ${detail}\n`
        )
        const state = this.codexRuns.get(jobId)
        if (state) {
          const terminalType =
            payload.status === 'cancelled' ? 'cancelled' : done ? 'completed' : 'error'
          this.deps.emit({
            type: 'run.event',
            data: {
              runId: state.runId,
              sequence: state.sequence++,
              createdAt,
              chatId,
              event:
                terminalType === 'cancelled'
                  ? { type: 'cancelled', data: { reason: detail } }
                  : terminalType === 'error'
                    ? { type: 'error', data: { error: detail } }
                    : { type: 'completed', data: null }
            }
          })
          this.codexRuns.delete(jobId)
        }
        return
      }

      case 'step/start':
      case 'step/end':
      case 'request/header':
      case 'request/context':
      case 'session/end-seed':
        return

      default:
        if (row.ignorable !== true) console.warn(`[box] unhandled LotusOS event type: ${row.type}`)
    }
  }

  private parseToolArguments(value: unknown): unknown {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value) as unknown
    } catch {
      return value
    }
  }

  private visibleText(content: unknown): string {
    if (!Array.isArray(content)) return ''
    return content
      .map((candidate) => {
        if (!candidate || typeof candidate !== 'object') return ''
        const block = candidate as Record<string, unknown>
        if (block.type === 'text' && typeof block.text === 'string') return block.text
        if (block.type === 'tool-result') return this.visibleText(block.content)
        return ''
      })
      .join('')
  }

  private startRun(sub: SessionSubscription, chatId: string, createdAt: number): void {
    const turnId = sub.pendingTurnIds.shift() ?? null
    const runId = randomUUID()
    sub.activeRun = { runId, sequence: 0, visibleTextLength: 0 }
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
   * notifications backend, so there is nothing to poll.
   */
  start(): void {
    // Intentionally empty — see the class comment above.
  }

  /** Abort all live event subscriptions and reset session bookkeeping on quit. */
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
