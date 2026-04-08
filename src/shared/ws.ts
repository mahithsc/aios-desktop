import type {
  Assistant,
  AssistantCreateRequest,
  AssistantDetail,
  AssistantSubmitRequest
} from './assistant'
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
  RunStopRequest,
  RunSnapshot
} from './run'

export type WSEnvelopeTypes =
  | 'assistant.create'
  | 'assistant.get'
  | 'assistant.list'
  | 'assistant.submit'
  | 'chat'
  | 'chat-history'
  | 'chat.submit'
  | 'cron.upcoming.list'
  | 'notification.list'
  | 'notification.created'
  | 'notification.dismiss'
  | 'run.accepted'
  | 'run.event'
  | 'run.stop'
  | 'process.snapshot.list'
  | 'run.resume'

export interface AssistantCreateWSEnvelope {
  type: 'assistant.create'
  data: AssistantCreateRequest | AssistantDetail
}

export interface AssistantGetWSEnvelope {
  type: 'assistant.get'
  data: string | AssistantDetail | null
}

export interface AssistantListWSEnvelope {
  type: 'assistant.list'
  data: Assistant[] | null
}

export interface AssistantSubmitWSEnvelope {
  type: 'assistant.submit'
  data: AssistantSubmitRequest | AssistantDetail
}

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

export interface RunStopWSEnvelope {
  type: 'run.stop'
  data: RunStopRequest
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
  | AssistantCreateWSEnvelope
  | AssistantGetWSEnvelope
  | AssistantListWSEnvelope
  | AssistantSubmitWSEnvelope
  | ChatWSEnvelope
  | ChatHistoryWSEnvelope
  | ChatSubmitWSEnvelope
  | CronUpcomingListWSEnvelope
  | NotificationListWSEnvelope
  | NotificationCreatedWSEnvelope
  | NotificationDismissWSEnvelope
  | RunAcceptedWSEnvelope
  | RunEventWSEnvelope
  | RunStopWSEnvelope
  | ProcessSnapshotListWSEnvelope
  | RunResumeWSEnvelope
