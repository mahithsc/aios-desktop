import type { Chat, ChatMetadata, LLMEvent } from './chat'
import type { CronUpcomingListResponse } from './cron'
import type {
  Notification,
  NotificationDismissRequest,
  NotificationListResponse
} from './notification'
import type {
  ProcessSnapshotListRequest,
  Run,
  RunEvent,
  RunResumeRequest,
  RunSnapshot
} from './run'

export type WSEnvelopeTypes =
  | 'chat'
  | 'chat-history'
  | 'chat.submit'
  | 'cron.upcoming.list'
  | 'notification.list'
  | 'notification.created'
  | 'notification.dismiss'
  | 'run.accepted'
  | 'run.event'
  | 'process.snapshot.list'
  | 'run.resume'

export interface ChatWSEnvelope {
  type: 'chat'
  data: Chat | LLMEvent
}

export interface ChatHistoryWSEnvelope {
  type: 'chat-history'
  data: ChatMetadata[] | Chat | string | null
}

export interface ChatSubmitWSEnvelope {
  type: 'chat.submit'
  data: {
    chat: Chat
    turnId: string
  }
}

export interface CronUpcomingListWSEnvelope {
  type: 'cron.upcoming.list'
  data: CronUpcomingListResponse | null
}

export interface NotificationListWSEnvelope {
  type: 'notification.list'
  data: NotificationListResponse | null
}

export interface NotificationCreatedWSEnvelope {
  type: 'notification.created'
  data: Notification
}

export interface NotificationDismissWSEnvelope {
  type: 'notification.dismiss'
  data: NotificationDismissRequest | Notification
}

export interface RunAcceptedWSEnvelope {
  type: 'run.accepted'
  data: Run
}

export interface RunEventWSEnvelope {
  type: 'run.event'
  data: RunEvent
}

export interface ProcessSnapshotListWSEnvelope {
  type: 'process.snapshot.list'
  data: ProcessSnapshotListRequest | RunSnapshot[] | null
}

export interface RunResumeWSEnvelope {
  type: 'run.resume'
  data: RunResumeRequest | RunEvent[]
}

export type WSEnvelope =
  | ChatWSEnvelope
  | ChatHistoryWSEnvelope
  | ChatSubmitWSEnvelope
  | CronUpcomingListWSEnvelope
  | NotificationListWSEnvelope
  | NotificationCreatedWSEnvelope
  | NotificationDismissWSEnvelope
  | RunAcceptedWSEnvelope
  | RunEventWSEnvelope
  | ProcessSnapshotListWSEnvelope
  | RunResumeWSEnvelope
