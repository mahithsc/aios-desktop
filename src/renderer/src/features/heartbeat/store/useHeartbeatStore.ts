import type { Run, RunEvent, RunSnapshot, RunStatus } from 'src/shared/run'
import { create } from 'zustand'

const TERMINAL_RUN_STATUSES: RunStatus[] = ['completed', 'error', 'cancelled']
const ACTIVE_RUN_STATUSES: RunStatus[] = ['queued', 'running']
const MAX_HEARTBEAT_RUNS = 12

export interface HeartbeatRunRecord {
  runId: string
  status: RunStatus
  createdAt: number | null
  updatedAt: number
  lastSequence: number
  preview: string | null
  activeStep: string | null
  lastError: string | null
}

type HeartbeatStoreState = {
  runsById: Record<string, HeartbeatRunRecord>
  eventsByRunId: Record<string, RunEvent[]>
  activeRunId: string | null
  lastRunId: string | null
  lastUpdatedAt: number | null
}

type HeartbeatStoreActions = {
  setSnapshots: (snapshots: RunSnapshot[]) => void
  acceptRun: (run: Run) => void
  applyEvent: (event: RunEvent) => void
  applyEvents: (events: RunEvent[]) => void
  clear: () => void
}

const emptyState = (): HeartbeatStoreState => ({
  runsById: {},
  eventsByRunId: {},
  activeRunId: null,
  lastRunId: null,
  lastUpdatedAt: null
})

const isHeartbeatRun = (run: Run): boolean => run.kind === 'heartbeat'

const isHeartbeatSnapshot = (snapshot: RunSnapshot): boolean => snapshot.kind === 'heartbeat'

const isHeartbeatEvent = (event: RunEvent, runsById: Record<string, HeartbeatRunRecord>): boolean =>
  event.kind === 'heartbeat' || event.runId in runsById

const derivePreviewFromEvent = (event: RunEvent): string | null => {
  const data = event.event.data ?? {}
  const value = data.value
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 160)
  }

  const message = data.message
  if (typeof message === 'string' && message.trim()) {
    return message.trim().slice(0, 160)
  }

  const error = data.error
  if (typeof error === 'string' && error.trim()) {
    return error.trim().slice(0, 160)
  }

  return null
}

const deriveActiveStepFromEvent = (event: RunEvent): string | null => {
  const data = event.event.data ?? {}
  const toolName = data.toolName
  if (event.event.type === 'tool_call_start' && typeof toolName === 'string' && toolName.trim()) {
    return toolName
  }

  if (TERMINAL_RUN_STATUSES.includes(deriveStatusFromEvent(event))) {
    return null
  }

  return event.event.type
}

const deriveStatusFromEvent = (event: RunEvent): RunStatus => {
  if (event.event.type === 'completed') {
    return 'completed'
  }

  if (event.event.type === 'error') {
    return 'error'
  }

  if (event.event.type === 'cancelled') {
    return 'cancelled'
  }

  return 'running'
}

const recalculatePointers = (
  runsById: Record<string, HeartbeatRunRecord>
): Pick<HeartbeatStoreState, 'activeRunId' | 'lastRunId' | 'lastUpdatedAt'> => {
  const runs = Object.values(runsById).sort((left, right) => right.updatedAt - left.updatedAt)
  const activeRun = runs.find((run) => ACTIVE_RUN_STATUSES.includes(run.status)) ?? null
  const lastRun = runs.find((run) => TERMINAL_RUN_STATUSES.includes(run.status)) ?? activeRun

  return {
    activeRunId: activeRun?.runId ?? null,
    lastRunId: lastRun?.runId ?? null,
    lastUpdatedAt: runs[0]?.updatedAt ?? null
  }
}

const pruneRuns = (
  runsById: Record<string, HeartbeatRunRecord>
): Record<string, HeartbeatRunRecord> => {
  const runs = Object.values(runsById).sort((left, right) => right.updatedAt - left.updatedAt)
  return Object.fromEntries(runs.slice(0, MAX_HEARTBEAT_RUNS).map((run) => [run.runId, run]))
}

const mergeRunEvents = (existing: RunEvent[] | undefined, nextEvents: RunEvent[]): RunEvent[] => {
  const eventsBySequence = new Map<number, RunEvent>()

  for (const event of existing ?? []) {
    eventsBySequence.set(event.sequence, event)
  }

  for (const event of nextEvents) {
    eventsBySequence.set(event.sequence, event)
  }

  return [...eventsBySequence.values()].sort((left, right) => left.sequence - right.sequence)
}

const pruneEvents = (
  eventsByRunId: Record<string, RunEvent[]>,
  runsById: Record<string, HeartbeatRunRecord>
): Record<string, RunEvent[]> =>
  Object.fromEntries(
    Object.entries(eventsByRunId).filter(([runId]) =>
      Object.prototype.hasOwnProperty.call(runsById, runId)
    )
  )

const mergeSnapshot = (
  existing: HeartbeatRunRecord | undefined,
  snapshot: RunSnapshot
): HeartbeatRunRecord => {
  if (
    existing &&
    (snapshot.lastSequence < existing.lastSequence || snapshot.updatedAt < existing.updatedAt)
  ) {
    return existing
  }

  return {
    runId: snapshot.runId,
    status: snapshot.status,
    createdAt: existing?.createdAt ?? null,
    updatedAt: snapshot.updatedAt,
    lastSequence: snapshot.lastSequence,
    preview: snapshot.preview ?? existing?.preview ?? null,
    activeStep: snapshot.activeStep ?? existing?.activeStep ?? null,
    lastError:
      snapshot.status === 'error'
        ? (snapshot.preview ?? existing?.lastError ?? null)
        : (existing?.lastError ?? null)
  }
}

const mergeAcceptedRun = (
  existing: HeartbeatRunRecord | undefined,
  run: Run
): HeartbeatRunRecord => {
  if (existing && existing.updatedAt > run.updatedAt) {
    return {
      ...existing,
      createdAt: existing.createdAt ?? run.createdAt
    }
  }

  return {
    runId: run.id,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    lastSequence: existing?.lastSequence ?? 0,
    preview: existing?.preview ?? null,
    activeStep:
      existing?.activeStep ?? (ACTIVE_RUN_STATUSES.includes(run.status) ? 'queued' : null),
    lastError: existing?.lastError ?? null
  }
}

const mergeEvent = (
  existing: HeartbeatRunRecord | undefined,
  event: RunEvent
): HeartbeatRunRecord => {
  if (existing && event.sequence <= existing.lastSequence) {
    return existing
  }

  const nextStatus = deriveStatusFromEvent(event)
  const nextPreview = derivePreviewFromEvent(event)
  const nextError =
    event.event.type === 'error'
      ? (event.event.data?.error as string | undefined)?.trim() || 'Heartbeat run failed.'
      : (existing?.lastError ?? null)

  return {
    runId: event.runId,
    status: nextStatus,
    createdAt: existing?.createdAt ?? event.createdAt,
    updatedAt: event.createdAt,
    lastSequence: Math.max(existing?.lastSequence ?? 0, event.sequence),
    preview: nextPreview ?? existing?.preview ?? null,
    activeStep: deriveActiveStepFromEvent(event),
    lastError: nextError
  }
}

export const useHeartbeatStore = create<HeartbeatStoreState & HeartbeatStoreActions>((set) => ({
  ...emptyState(),

  setSnapshots: (snapshots) =>
    set((state) => {
      const nextRunsById = { ...state.runsById }
      for (const snapshot of snapshots) {
        if (!isHeartbeatSnapshot(snapshot)) {
          continue
        }

        nextRunsById[snapshot.runId] = mergeSnapshot(nextRunsById[snapshot.runId], snapshot)
      }

      const prunedRunsById = pruneRuns(nextRunsById)
      return {
        runsById: prunedRunsById,
        eventsByRunId: pruneEvents(state.eventsByRunId, prunedRunsById),
        ...recalculatePointers(prunedRunsById)
      }
    }),

  acceptRun: (run) =>
    set((state) => {
      if (!isHeartbeatRun(run)) {
        return state
      }

      const nextRunsById = {
        ...state.runsById,
        [run.id]: mergeAcceptedRun(state.runsById[run.id], run)
      }
      const prunedRunsById = pruneRuns(nextRunsById)
      return {
        runsById: prunedRunsById,
        eventsByRunId: pruneEvents(state.eventsByRunId, prunedRunsById),
        ...recalculatePointers(prunedRunsById)
      }
    }),

  applyEvent: (event) =>
    set((state) => {
      if (!isHeartbeatEvent(event, state.runsById)) {
        return state
      }

      const nextRunsById = {
        ...state.runsById,
        [event.runId]: mergeEvent(state.runsById[event.runId], event)
      }
      const prunedRunsById = pruneRuns(nextRunsById)
      const nextEventsByRunId = {
        ...state.eventsByRunId,
        [event.runId]: mergeRunEvents(state.eventsByRunId[event.runId], [event])
      }
      return {
        runsById: prunedRunsById,
        eventsByRunId: pruneEvents(nextEventsByRunId, prunedRunsById),
        ...recalculatePointers(prunedRunsById)
      }
    }),

  applyEvents: (events) =>
    set((state) => {
      if (events.length === 0) {
        return state
      }

      let hasHeartbeatEvent = false
      const nextRunsById = { ...state.runsById }
      const nextEventsByRunId = { ...state.eventsByRunId }

      for (const event of events) {
        if (!isHeartbeatEvent(event, nextRunsById)) {
          continue
        }

        hasHeartbeatEvent = true
        nextRunsById[event.runId] = mergeEvent(nextRunsById[event.runId], event)
        nextEventsByRunId[event.runId] = mergeRunEvents(nextEventsByRunId[event.runId], [event])
      }

      if (!hasHeartbeatEvent) {
        return state
      }

      const prunedRunsById = pruneRuns(nextRunsById)
      return {
        runsById: prunedRunsById,
        eventsByRunId: pruneEvents(nextEventsByRunId, prunedRunsById),
        ...recalculatePointers(prunedRunsById)
      }
    }),

  clear: () => emptyState()
}))
