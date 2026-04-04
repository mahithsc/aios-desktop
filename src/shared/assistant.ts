import type { UnixMs } from './chat'

export interface Assistant {
  id: string
  chatId: string
  title: string
  createdAt: UnixMs
  updatedAt: UnixMs
  heartbeatEnabled: boolean
  identityPath: string
  heartbeatPath: string
  memoryPath: string
}

export interface AssistantInitRequest {
  chatId: string
  title?: string | null
  identityBody?: string | null
  heartbeatBody?: string | null
  memoryBody?: string | null
}
