import { Activity, ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState, type JSX } from 'react'
import type { AssistantMessage, LLMEvent, MessageStatus } from 'src/shared/chat'
import ChatMessages from '../../components/ChatMessages'
import { runEventToChatEvent } from '../../lib/runEventToChatEvent'
import { useHeartbeatStore } from '../../store/useHeartbeatStore'

const formatTimestamp = (timestamp: number | null): string => {
  if (!timestamp) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(timestamp)
}

const getStatusLabel = (
  status: ReturnType<typeof useHeartbeatStore.getState>['runsById'][string]['status'] | null
): string => {
  if (status === 'running') return 'Running'
  if (status === 'queued') return 'Queued'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Stopped'
  if (status === 'error') return 'Error'
  return 'Unknown'
}

const getStatusClassName = (
  status: ReturnType<typeof useHeartbeatStore.getState>['runsById'][string]['status'] | null
): string => {
  if (status === 'running') {
    return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
  }

  if (status === 'queued') {
    return 'bg-secondary text-secondary-foreground ring-border'
  }

  if (status === 'completed') {
    return 'bg-muted text-muted-foreground ring-border'
  }

  if (status === 'cancelled') {
    return 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
  }

  if (status === 'error') {
    return 'bg-red-500/15 text-red-200 ring-red-500/30'
  }

  return 'bg-muted text-muted-foreground ring-border'
}

const getMessageStatus = (
  status: ReturnType<typeof useHeartbeatStore.getState>['runsById'][string]['status'] | null
): MessageStatus => {
  if (status === 'error') {
    return 'error'
  }

  if (status === 'cancelled') {
    return 'cancelled'
  }

  if (status === 'completed') {
    return 'complete'
  }

  if (status === 'queued') {
    return 'pending'
  }

  return 'streaming'
}

type HeartbeatsProps = {
  onBack: () => void
}

const Heartbeats = ({ onBack }: HeartbeatsProps): JSX.Element => {
  const activeHeartbeatRunId = useHeartbeatStore((state) => state.activeRunId)
  const lastHeartbeatRunId = useHeartbeatStore((state) => state.lastRunId)
  const heartbeatRunsById = useHeartbeatStore((state) => state.runsById)
  const heartbeatEventsByRunId = useHeartbeatStore((state) => state.eventsByRunId)
  const currentRunId = activeHeartbeatRunId ?? lastHeartbeatRunId
  const currentRun = currentRunId ? heartbeatRunsById[currentRunId] ?? null : null
  const events = currentRunId ? heartbeatEventsByRunId[currentRunId] ?? [] : []
  const [isHydrating, setIsHydrating] = useState(false)

  useEffect(() => {
    if (!currentRunId) {
      setIsHydrating(false)
      return undefined
    }

    setIsHydrating(true)

    const unsubscribe = window.api.onSocketEvent((socketEvent) => {
      if (socketEvent.type === 'run.resume') {
        setIsHydrating(false)
        return
      }

      if (
        socketEvent.type === 'run.event' &&
        typeof socketEvent.data === 'object' &&
        socketEvent.data !== null &&
        'runId' in socketEvent.data &&
        socketEvent.data.runId === currentRunId
      ) {
        setIsHydrating(false)
      }
    })

    window.api.sendSocketMessage({
      type: 'run.resume',
      data: {
        runId: currentRunId,
        afterSequence: 0
      }
    })

    return () => {
      unsubscribe()
    }
  }, [currentRunId])

  const llmEvents = useMemo(() => {
    return events.reduce<LLMEvent[]>((accumulator, runEvent) => {
      const nextEvent = runEventToChatEvent(runEvent)
      if (nextEvent) {
        accumulator.push(nextEvent)
      }
      return accumulator
    }, [])
  }, [events])

  const messages = useMemo<AssistantMessage[]>(() => {
    if (!currentRun) {
      return []
    }

    return [
      {
        id: currentRun.runId,
        createdAt: currentRun.createdAt ?? currentRun.updatedAt,
        updatedAt: currentRun.updatedAt,
        status: getMessageStatus(currentRun.status),
        role: 'assistant',
        runId: currentRun.runId,
        events: llmEvents
      }
    ]
  }, [currentRun, llmEvents])

  return (
    <div className="flex h-full min-h-0 w-full items-start justify-center overflow-y-auto pt-20 sm:pt-24">
      <div className="mx-auto flex min-h-0 w-full max-w-184 flex-col gap-6 px-4 pb-8 sm:px-6 sm:pb-10">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        </div>

        <section className="rounded-3xl border border-border bg-card px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span>Heartbeat</span>
              </div>
              <h1 className="mt-2 text-xl tracking-tight text-foreground">Latest heartbeat</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                {activeHeartbeatRunId
                  ? 'Showing the current heartbeat as it runs.'
                  : currentRun
                    ? 'Showing the most recent heartbeat until a new one starts.'
                    : 'No heartbeat runs observed yet.'}
              </div>
            </div>

            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] ring-1 ${getStatusClassName(currentRun?.status ?? null)}`}
            >
              {getStatusLabel(currentRun?.status ?? null)}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>Started {formatTimestamp(currentRun?.createdAt ?? null)}</span>
            <span aria-hidden="true">•</span>
            <span>Updated {formatTimestamp(currentRun?.updatedAt ?? null)}</span>
            {currentRun ? (
              <>
                <span aria-hidden="true">•</span>
                <span className="font-mono normal-case tracking-normal">{currentRun.runId}</span>
              </>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card px-5 py-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground">Heartbeat activity</div>
            <div className="text-xs text-muted-foreground">
              {events.length > 0 ? `${events.length} events` : isHydrating ? 'Loading' : 'No events'}
            </div>
          </div>

          {messages.length > 0 ? (
            <ChatMessages messages={messages} bottomSpacerClassName="h-8" darkMode />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground">
              {isHydrating
                ? 'Loading heartbeat history...'
                : currentRun?.status === 'queued'
                  ? 'The next heartbeat is queued and has not emitted any events yet.'
                  : 'No heartbeat activity to show yet.'}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Heartbeats
