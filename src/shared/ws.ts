import type { Chat, ChatMetadata, LLMEvent } from './chat'
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
  data: Chat
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
  | RunAcceptedWSEnvelope
  | RunEventWSEnvelope
  | ProcessSnapshotListWSEnvelope
  | RunResumeWSEnvelope
