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
  | 'codex.input.requested'
  | 'codex.input.resolved'
  | 'codex.input.failed'
  | 'codex.input.submit'

export interface CodexInputOption {
  label: string
  description: string
}

export interface CodexInputQuestion {
  id: string
  header: string
  question: string
  isOther: boolean
  isSecret: boolean
  options: CodexInputOption[] | null
}

export interface CodexInputRequest {
  jobId: string
  chatId: string
  itemId?: string | null
  questions: CodexInputQuestion[]
  error?: string
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

export interface CodexInputRequestedWSEnvelope {
  type: 'codex.input.requested'
  data: CodexInputRequest
}

export interface CodexInputResolvedWSEnvelope {
  type: 'codex.input.resolved'
  data: { jobId: string; chatId: string }
}

export interface CodexInputFailedWSEnvelope {
  type: 'codex.input.failed'
  data: { jobId: string; chatId: string; error: string }
}

export interface CodexInputSubmitWSEnvelope {
  type: 'codex.input.submit'
  data: { jobId: string; chatId: string; answers: Record<string, string[]> }
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
  | RunStopWSEnvelope
  | ProcessSnapshotListWSEnvelope
  | RunResumeWSEnvelope
  | CodexInputRequestedWSEnvelope
  | CodexInputResolvedWSEnvelope
  | CodexInputFailedWSEnvelope
  | CodexInputSubmitWSEnvelope
