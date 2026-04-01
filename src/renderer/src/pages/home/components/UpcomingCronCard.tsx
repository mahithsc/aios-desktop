import type { JSX } from 'react'
import type { CronUpcomingItem } from 'src/shared/cron'

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(timestamp)

const formatRelativeTime = (timestamp: number): string => {
  const diffMs = timestamp - Date.now()

  if (diffMs <= 60_000) {
    return 'Soon'
  }

  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 60) {
    return `In ${minutes} min`
  }

  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `In ${hours} hr`
  }

  const days = Math.round(hours / 24)
  return `In ${days} day${days === 1 ? '' : 's'}`
}

const getCronSubtitle = (cron: CronUpcomingItem): string => {
  if (cron.runAtUtc) {
    return 'One-time job'
  }

  if (cron.schedule && cron.scheduleTimezone) {
    return `${cron.schedule} • ${cron.scheduleTimezone}`
  }

  return cron.schedule || cron.scheduleTimezone || 'Scheduled job'
}

type UpcomingCronCardProps = {
  cron: CronUpcomingItem
}

const UpcomingCronCard = ({ cron }: UpcomingCronCardProps): JSX.Element => {
  return (
    <article className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{cron.name}</div>
          {cron.description.trim() ? (
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{cron.description}</div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
          {formatRelativeTime(cron.nextRunAt)}
        </span>
      </div>

      <div className="mt-3 text-sm text-foreground">Runs {formatTimestamp(cron.nextRunAt)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{getCronSubtitle(cron)}</div>
    </article>
  )
}

export default UpcomingCronCard
