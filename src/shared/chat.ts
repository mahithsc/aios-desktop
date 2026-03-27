export type UnixMs = number

export type ChatStatus = 'idle' | 'streaming' | 'error'

export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error'

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

export type LLMEvent =
  | StreamStartEvent
  | TokenEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | ToolCallErrorEvent
  | StreamEndEvent
  | StreamErrorEvent
