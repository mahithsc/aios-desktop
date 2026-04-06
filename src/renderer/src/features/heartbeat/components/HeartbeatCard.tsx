import { Activity } from 'lucide-react'
import type { JSX } from 'react'
import type { HeartbeatRunRecord } from '../store/useHeartbeatStore'

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(timestamp)

const getStatusLabel = (status: HeartbeatRunRecord['status']): string => {
  if (status === 'running') return 'Running'
  if (status === 'queued') return 'Queued'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Stopped'
  return 'Error'
}

const getStatusClassName = (status: HeartbeatRunRecord['status']): string => {
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

  return 'bg-red-500/15 text-red-200 ring-red-500/30'
}

const getHeartbeatSummary = (run: HeartbeatRunRecord): string =>
  run.lastError?.trim() || run.preview?.trim() || 'No heartbeat output yet.'

type HeartbeatCardProps = {
  run: HeartbeatRunRecord
  title: string
  onClick: () => void
}

const HeartbeatCard = ({ run, title, onClick }: HeartbeatCardProps): JSX.Element => {
  const timingLabel = run.status === 'running' || run.status === 'queued' ? 'Updated' : 'Finished'
  const summary = getHeartbeatSummary(run)

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-2xl border border-border bg-card px-4 py-4 text-left shadow-sm transition hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>{title}</span>
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {run.activeStep?.trim() || 'Heartbeat check'}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${getStatusClassName(run.status)}`}
        >
          {getStatusLabel(run.status)}
        </span>
      </div>

      <div className="mt-3 text-sm leading-6 text-muted-foreground">
        {summary}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>
          {timingLabel} {formatTimestamp(run.updatedAt)}
        </span>
        <span aria-hidden="true">•</span>
        <span className="font-mono normal-case tracking-normal text-muted-foreground">
          {run.runId.slice(0, 8)}
        </span>
      </div>
    </button>
  )
}

export default HeartbeatCard
