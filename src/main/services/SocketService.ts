import { Buffer } from 'node:buffer'
import type { WSEnvelope } from '../../shared/ws'

export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface SocketCloseDetails {
  code?: number
  reason?: string
  wasClean?: boolean
  intentional: boolean
}
export type MessageListener = (message: WSEnvelope) => void
export type StateListener = (state: SocketConnectionState) => void
export type ErrorListener = (error: unknown) => void
export type CloseListener = (details: SocketCloseDetails) => void
export type ReconnectDelayStrategy = (attempt: number) => number

const DEFAULT_RECONNECT_DELAY_MS = 2_000
const SOCKET_OPEN = 1

export class SocketService {
  private socket: WebSocket | null = null
  private url: string | null = null
  private state: SocketConnectionState = 'disconnected'
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manualDisconnect = false
  private readonly messageListeners = new Set<MessageListener>()
  private readonly stateListeners = new Set<StateListener>()
  private readonly errorListeners = new Set<ErrorListener>()
  private readonly closeListeners = new Set<CloseListener>()

  constructor(
    private readonly reconnectDelayMs: number | ReconnectDelayStrategy = DEFAULT_RECONNECT_DELAY_MS
  ) {}

  get connectionState(): SocketConnectionState {
    return this.state
  }

  get connectionUrl(): string | null {
    return this.url
  }

  get isConnected(): boolean {
    return this.state === 'connected'
  }

  connect(url: string): void {
    if (!url.trim()) {
      throw new Error('Socket URL is required.')
    }

    const nextUrl = url.trim()
    const isSameConnectionTarget =
      this.url === nextUrl && (this.state === 'connecting' || this.state === 'connected')

    if (isSameConnectionTarget) {
      return
    }

    this.manualDisconnect = false
    this.url = nextUrl
    this.reconnectAttempt = 0
    this.clearReconnectTimer()

    if (this.socket) {
      const existingSocket = this.socket
      this.socket = null
      existingSocket.close(1000, 'Replacing socket connection')
    }

    this.openSocket('connecting')
  }

  disconnect(code = 1000, reason = 'Client disconnected'): void {
    this.manualDisconnect = true
    this.clearReconnectTimer()

    if (!this.socket) {
      this.setState('disconnected')
      return
    }

    const socket = this.socket
    this.socket = null
    socket.close(code, reason)
    this.setState('disconnected')
  }

  destroy(): void {
    this.disconnect(1000, 'Socket service destroyed')
    this.messageListeners.clear()
    this.stateListeners.clear()
    this.errorListeners.clear()
    this.closeListeners.clear()
  }

  send(message: WSEnvelope): void {
    if (!this.socket || this.socket.readyState !== SOCKET_OPEN) {
      throw new Error('Cannot send socket message before the connection is open.')
    }

    this.socket.send(JSON.stringify(message))
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener)
    return () => {
      this.messageListeners.delete(listener)
    }
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    listener(this.state)

    return () => {
      this.stateListeners.delete(listener)
    }
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener)
    return () => {
      this.errorListeners.delete(listener)
    }
  }

  onClose(listener: CloseListener): () => void {
    this.closeListeners.add(listener)
    return () => {
      this.closeListeners.delete(listener)
    }
  }

  private openSocket(
    nextState: Extract<SocketConnectionState, 'connecting' | 'reconnecting'>
  ): void {
    if (!this.url) {
      throw new Error('Socket URL is not set.')
    }

    const socket = new WebSocket(this.url)
    this.socket = socket
    this.setState(nextState)

    socket.onopen = () => {
      if (this.socket !== socket) {
        return
      }

      this.reconnectAttempt = 0
      this.setState('connected')
    }

    socket.onmessage = (event) => {
      if (this.socket !== socket) {
        return
      }

      try {
        const message = parseEnvelope(event.data)
        for (const listener of this.messageListeners) {
          listener(message)
        }
      } catch (error) {
        this.emitError(error)
      }
    }

    socket.onerror = (event) => {
      if (this.socket !== socket) {
        return
      }

      this.emitError(event)
    }

    socket.onclose = (event) => {
      if (this.socket !== socket) {
        return
      }

      this.socket = null

      const details: SocketCloseDetails = {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        intentional: this.manualDisconnect
      }

      for (const listener of this.closeListeners) {
        listener(details)
      }

      if (details.intentional) {
        this.setState('disconnected')
        return
      }

      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (!this.url || this.reconnectTimer) {
      return
    }

    const attempt = this.reconnectAttempt + 1
    const delayMs =
      typeof this.reconnectDelayMs === 'function'
        ? this.reconnectDelayMs(attempt)
        : this.reconnectDelayMs

    this.setState('reconnecting')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectAttempt = attempt

      if (!this.manualDisconnect) {
        this.openSocket('reconnecting')
      }
    }, delayMs)
  }

  private emitError(error: unknown): void {
    for (const listener of this.errorListeners) {
      listener(error)
    }
  }

  private setState(nextState: SocketConnectionState): void {
    if (this.state === nextState) {
      return
    }

    this.state = nextState

    for (const listener of this.stateListeners) {
      listener(nextState)
    }
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return
    }

    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }
}

function normalizeSocketData(data: unknown): string {
  if (typeof data === 'string') {
    return data
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf8')
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8')
  }

  throw new Error('Unsupported socket message payload.')
}

function parseEnvelope(data: unknown): WSEnvelope {
  return JSON.parse(normalizeSocketData(data)) as WSEnvelope
}
