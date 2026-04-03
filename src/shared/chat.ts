export type UnixMs = number

export type ChatStatus = 'idle' | 'streaming' | 'error' | 'cancelled'

export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error' | 'cancelled'

export type AttachmentKind = 'image' | 'file' | 'audio'

export interface MessageAttachment {
  id: string
  kind: AttachmentKind
  name: string
  filePath: string
  mimeType?: string
  sizeBytes?: number
  uploadedAt?: UnixMs
}

export interface ChatMetadata {
  id: string
  title?: string
  createdAt: UnixMs
  updatedAt: UnixMs
  status?: ChatStatus
}

export interface Chat extends ChatMetadata {
  messages: ChatMessage[]
}

interface BaseMessage {
  id: string
  createdAt: UnixMs
  updatedAt: UnixMs
  status: MessageStatus
}

export interface UserMessage extends BaseMessage {
  role: 'user'
  content: string
  attachments?: MessageAttachment[]
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant'
  runId?: string | null
  events: LLMEvent[]
}

export type ChatMessage = UserMessage | AssistantMessage

interface BaseLLMEvent {
  id: string
  createdAt: UnixMs
}

export interface StreamStartEvent extends BaseLLMEvent {
  type: 'stream_start'
}

export interface TokenEvent extends BaseLLMEvent {
  type: 'token'
  value: string
}

export interface ToolCallStartEvent extends BaseLLMEvent {
  type: 'tool_call_start'
  toolCallId: string
  toolName: string
  input?: unknown
}

export interface ToolCallEndEvent extends BaseLLMEvent {
  type: 'tool_call_end'
  toolCallId: string
  toolName: string
  output?: unknown
}

export interface ToolCallErrorEvent extends BaseLLMEvent {
  type: 'tool_call_error'
  toolCallId: string
  toolName: string
  error: string
}

export interface StreamEndEvent extends BaseLLMEvent {
  type: 'stream_end'
}

export interface StreamErrorEvent extends BaseLLMEvent {
  type: 'stream_error'
  error: string
}

export interface StreamCancelledEvent extends BaseLLMEvent {
  type: 'stream_cancelled'
  reason: string
}

export type SubagentChildEventType =
  | 'stream_start'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'tool_call_error'
  | 'stream_end'
  | 'stream_error'

export interface SubagentToolEvent extends BaseLLMEvent {
  type: 'subagent_tool_event'
  parentToolCallId: string
  childRunId: string
  childEventType: SubagentChildEventType
  toolCallId?: string | null
  toolName?: string | null
  input?: unknown
  output?: unknown
  error?: string | null
}

export type LLMEvent =
  | StreamStartEvent
  | TokenEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | ToolCallErrorEvent
  | StreamEndEvent
  | StreamErrorEvent
  | StreamCancelledEvent
  | SubagentToolEvent
