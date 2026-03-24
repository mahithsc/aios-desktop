import type { UnixMs } from './chat'
import type { RunKind } from './run'

export type NotificationSource = RunKind | 'system'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  source: NotificationSource
  sourceId?: string | null
  runId?: string | null
  chatId?: string | null
  level: NotificationLevel
  title: string
  body: string
  createdAt: UnixMs
  updatedAt: UnixMs
  dismissedAt?: UnixMs | null
}

export interface NotificationListResponse {
  notifications: Notification[]
}

export interface NotificationDismissRequest {
  id: string
}
