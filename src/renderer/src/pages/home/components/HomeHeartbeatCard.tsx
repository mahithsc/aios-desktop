import type { JSX } from 'react'
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

const HomeHeartbeatCard = ({ run, title, onClick }: HomeHeartbeatCardProps): JSX.Element => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block h-full w-full rounded-[1.5rem] bg-card px-3.5 py-3.5 text-left shadow-sm transition hover:bg-accent"
    >
      <div className="flex h-full flex-col justify-between">
        <div className="text-[1.65rem] font-light tracking-tight text-foreground">
          {getStatusLabel(run.status)}
        </div>

        <div className="space-y-0.5">
          <div className="truncate text-[12px] font-medium text-foreground">
            {run.activeStep?.trim() || title}
          </div>
          <div className="line-clamp-2 text-[12px] font-medium text-foreground/85">
            {getHeartbeatSummary(run)}
          </div>
        </div>
      </div>
    </button>
  )
}

export default HomeHeartbeatCard
