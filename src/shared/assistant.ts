import type { ChatMessage, UnixMs } from './chat'

export interface Assistant {
  id: string
  title: string
  createdAt: UnixMs
  updatedAt: UnixMs
  heartbeatEnabled: boolean
  identityPath: string
  heartbeatPath: string
  memoryPath: string
}

export interface AssistantDetail extends Assistant {
  messages: ChatMessage[]
}

export interface AssistantCreateRequest {
  id: string
  title?: string | null
  prompt: string
}

export interface AssistantSubmitRequest {
  assistantId: string
  messages: ChatMessage[]
  turnId?: string | null
}
