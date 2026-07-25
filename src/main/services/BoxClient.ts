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

// How often to poll the box for new notifications. Replaces the old `/ws`
// `notification.created` push now that there's no persistent socket.
const NOTIFICATION_POLL_INTERVAL_MS = 5_000

/**
 * HTTP + SSE replacement for the retired box WebSocket (`/ws`).
 *
 * It preserves the old socket surface the renderer speaks — take a
 * {@link WSEnvelope} in via {@link send}, hand {@link WSEnvelope}s back out via
 * `emit` — but under the hood it translates each message to the box's HTTP
 * routes: reads over `GET`, chat turns over `POST /message` (SSE), and it polls
 * `GET /notifications` to surface new notifications. No WebSocket involved.
 */
export class BoxClient {
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private seenNotificationIds: Set<string> | null = null
  private readonly activeStreams = new Set<AbortController>()

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
          return await this.handleNotificationDismiss(envelope.data)
        case 'cron.upcoming.list':
          return await this.handleCronUpcoming()
        case 'chat':
        case 'chat.submit':
          return await this.handleChat(envelope)
        default:
          console.warn(`[box] unhandled message type: ${envelope.type}`)
      }
    } catch (error) {
      console.error(`[box] send(${envelope.type}) failed`, error)
    }
  }

  private async handleChatHistory(data: unknown): Promise<void> {
    const chatId = typeof data === 'string' ? data : null
    const res = await this.boxFetch(chatId ? `/chats/${encodeURIComponent(chatId)}` : '/chats')
    if (!res || !res.ok) {
      this.deps.emit({ type: 'chat-history', data: chatId ? null : [] })
      return
    }
    this.deps.emit({ type: 'chat-history', data: await res.json() })
  }

  private async handleNotificationList(): Promise<void> {
    const res = await this.boxFetch('/notifications')
    if (!res || !res.ok) {
      this.deps.emit({ type: 'notification.list', data: { notifications: [] } })
      return
    }
    const payload = await res.json()
    this.deps.emit({ type: 'notification.list', data: payload })
    // Seed the polling baseline so already-known notifications don't re-fire as
    // native notifications.
    if (this.seenNotificationIds === null) {
      this.seenNotificationIds = new Set(this.extractIds(payload))
    }
  }

  private async handleCronUpcoming(): Promise<void> {
    const res = await this.boxFetch('/crons/upcoming')
    if (!res || !res.ok) {
      this.deps.emit({ type: 'cron.upcoming.list', data: { crons: [] } })
      return
    }
    this.deps.emit({ type: 'cron.upcoming.list', data: await res.json() })
  }

  private async handleNotificationDismiss(data: unknown): Promise<void> {
    const id =
      data && typeof data === 'object' && 'id' in data
        ? (data as { id?: unknown }).id
        : undefined
    if (typeof id !== 'string' || !id) return
    const res = await this.boxFetch(`/notifications/${encodeURIComponent(id)}/dismiss`, {
      method: 'POST'
    })
    if (!res || !res.ok) return
    // Echo the dismissed notification so the renderer removes it from its store
    // (mirrors the old `/ws` dismiss broadcast).
    this.deps.emit({ type: 'notification.dismiss', data: await res.json() })
    this.seenNotificationIds?.delete(id)
  }

  private async handleChat(envelope: WSEnvelope): Promise<void> {
    let body: { chat: unknown; turnId: string | null }
    if (
      envelope.type === 'chat.submit' &&
      envelope.data &&
      typeof envelope.data === 'object' &&
      'chat' in envelope.data
    ) {
      const data = envelope.data as { chat: unknown; turnId?: unknown }
      body = { chat: data.chat, turnId: typeof data.turnId === 'string' ? data.turnId : null }
    } else {
      body = { chat: envelope.data, turnId: null }
    }

    const controller = new AbortController()
    this.activeStreams.add(controller)
    try {
      const res = await this.boxFetch('/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      if (!res || !res.ok || !res.body) return
      await this.consumeSse(res.body)
    } finally {
      this.activeStreams.delete(controller)
    }
  }

  /** Parse an SSE stream and forward each `run.accepted`/`run.event` frame. */
  private async consumeSse(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        this.dispatchSseFrame(buffer.slice(0, sep))
        buffer = buffer.slice(sep + 2)
      }
    }
    if (buffer.trim()) this.dispatchSseFrame(buffer)
  }

  private dispatchSseFrame(frame: string): void {
    const raw = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n')
    if (!raw) return
    let payload: { type?: string; data?: unknown }
    try {
      payload = JSON.parse(raw)
    } catch {
      return
    }
    // `done` is just a terminal marker for the SSE stream — nothing to forward.
    if (!payload.type || payload.type === 'done') return
    this.deps.emit({ type: payload.type, data: payload.data } as WSEnvelope)
  }

  private extractIds(payload: unknown): string[] {
    const notifications =
      payload && typeof payload === 'object'
        ? (payload as { notifications?: unknown }).notifications
        : undefined
    if (!Array.isArray(notifications)) return []
    return notifications
      .map((n) => (n && typeof n === 'object' ? (n as { id?: unknown }).id : undefined))
      .filter((id): id is string => typeof id === 'string')
  }

  /**
   * Start polling the box for new notifications. Idempotent. The first poll
   * establishes a baseline (no native notifications fire for pre-existing
   * items); subsequent new notifications are forwarded as `notification.created`.
   */
  start(): void {
    if (this.pollTimer) return
    void this.pollNotifications()
    this.pollTimer = setInterval(() => void this.pollNotifications(), NOTIFICATION_POLL_INTERVAL_MS)
  }

  private async pollNotifications(): Promise<void> {
    const res = await this.boxFetch('/notifications')
    if (!res || !res.ok) return
    const payload = await res.json()
    const ids = this.extractIds(payload)
    if (this.seenNotificationIds === null) {
      this.seenNotificationIds = new Set(ids)
      return
    }
    const notifications: unknown[] = Array.isArray(payload?.notifications)
      ? payload.notifications
      : []
    for (const notification of notifications) {
      const id =
        notification && typeof notification === 'object'
          ? (notification as { id?: unknown }).id
          : undefined
      if (typeof id === 'string' && !this.seenNotificationIds.has(id)) {
        this.seenNotificationIds.add(id)
        this.deps.emit({ type: 'notification.created', data: notification } as WSEnvelope)
      }
    }
  }

  /** Stop polling, abort in-flight chat streams, and reset state (e.g. on unpair/quit). */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    for (const controller of this.activeStreams) controller.abort()
    this.activeStreams.clear()
    this.seenNotificationIds = null
  }
}
