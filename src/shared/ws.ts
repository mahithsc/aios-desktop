import type { Chat, ChatMetadata, LLMEvent } from './chat'

export type WSEnvelopeTypes = 'chat' | 'chat-history'

export interface ChatWSEnvelope {
  type: 'chat'
  data: Chat | LLMEvent
}

export interface ChatHistoryWSEnvelope {
  type: 'chat-history'
  data: ChatMetadata[] | Chat | string | null
}

export type WSEnvelope = ChatWSEnvelope | ChatHistoryWSEnvelope
