import { useEffect, useState, type JSX } from 'react'
import type { HeartbeatRunRecord } from '../../../features/heartbeat/store/useHeartbeatStore'

type HomeHeartbeatCardProps = {
  run: HeartbeatRunRecord
  title: string
  onClick: () => void
}

const getStatusLabel = (status: HeartbeatRunRecord['status']): string => {
  if (status === 'running') return 'Running'
  if (status === 'queued') return 'Queued'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Stopped'
  return 'Error'
}

const getHeartbeatSummary = (run: HeartbeatRunRecord): string =>
  run.lastError?.trim() || run.preview?.trim() || 'No heartbeat output yet.'

const formatRelativeTime = (timestamp: number, now: number): string => {
  const diffMs = Math.max(0, now - timestamp)

  if (diffMs < 60_000) {
    const seconds = Math.max(1, Math.floor(diffMs / 1000))
    return `${seconds} sec${seconds === 1 ? '' : 's'} ago`
  }

  if (diffMs < 3_600_000) {
    const minutes = Math.floor(diffMs / 60_000)
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  }

  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000)
    return `${hours} hr${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(diffMs / 86_400_000)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const HomeHeartbeatCard = ({ run, title, onClick }: HomeHeartbeatCardProps): JSX.Element => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <button
      type="button"
      onClick={onClick}
      className="block h-full w-full rounded-[1.5rem] bg-card px-3.5 py-3.5 text-left shadow-sm transition hover:bg-accent"
    >
      <div className="flex h-full flex-col justify-between">
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-muted-foreground">
            Heartbeat
          </div>
          <div className="text-[1.65rem] font-light tracking-tight text-foreground">
            {getStatusLabel(run.status)}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="truncate text-[12px] font-medium text-foreground">
            {run.activeStep?.trim() || title}
          </div>
          <div className="line-clamp-2 text-[12px] font-medium text-foreground/85">
            {getHeartbeatSummary(run)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Last run {formatRelativeTime(run.updatedAt, now)}
          </div>
        </div>
      </div>
    </button>
  )
}

export default HomeHeartbeatCard
