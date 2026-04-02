import type { UnixMs } from './chat'

export type RunKind = 'chat' | 'cron' | 'heartbeat'

export type RunStatus = 'queued' | 'running' | 'completed' | 'error' | 'cancelled'

export type RunEventType =
  | 'started'
  | 'token'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'progress'
  | 'completed'
  | 'error'
  | 'cancelled'

export interface Run {
  id: string
  kind: RunKind
  status: RunStatus
  createdAt: UnixMs
  updatedAt: UnixMs
  chatId?: string | null
  sourceId?: string | null
  turnId?: string | null
}

export interface RunEventPayload {
  type: RunEventType
  data?: Record<string, unknown> | null
}

export interface RunEvent {
  runId: string
  sequence: number
  createdAt: UnixMs
  chatId?: string | null
  event: RunEventPayload
}

export interface RunSnapshot {
  runId: string
  kind: RunKind
  status: RunStatus
  updatedAt: UnixMs
  chatId?: string | null
  lastSequence: number
  preview?: string | null
  activeStep?: string | null
}

export interface ProcessSnapshotListRequest {
  statuses?: RunStatus[]
}

export interface RunResumeRequest {
  runId: string
  afterSequence: number
}

export interface RunStopRequest {
  runId: string
}
