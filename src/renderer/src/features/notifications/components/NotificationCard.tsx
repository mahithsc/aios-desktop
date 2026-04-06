import type { JSX } from 'react'
import type { Notification } from 'src/shared/notification'

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(timestamp)

const getLevelClassName = (level: Notification['level']): string => {
  if (level === 'success') {
    return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
  }

  if (level === 'warning') {
    return 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
  }

  if (level === 'error') {
    return 'bg-red-500/15 text-red-200 ring-red-500/30'
  }

  return 'bg-secondary text-secondary-foreground ring-border'
}

type NotificationCardProps = {
  notification: Notification
  onDismiss: (notificationId: string) => void
}

const NotificationCard = ({ notification, onDismiss }: NotificationCardProps): JSX.Element => {
  return (
    <article className="group relative h-full rounded-2xl border border-border bg-card px-3 py-3 shadow-sm transition hover:bg-accent">
      <button
        type="button"
        aria-label={`Dismiss ${notification.title}`}
        onClick={() => onDismiss(notification.id)}
        className="absolute -left-2 -top-2 rounded-full border border-border bg-card px-2 py-1 text-xs leading-none text-muted-foreground opacity-0 shadow-sm transition hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        x
      </button>

      <div className="flex h-full items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{notification.title}</div>
            <div className="mt-1 max-h-16 overflow-hidden text-xs leading-5 text-muted-foreground">
              {notification.body}
            </div>
          </div>

          <div className="mt-auto pt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span
              className={`rounded-full px-2 py-0.5 font-medium ring-1 ${getLevelClassName(notification.level)}`}
            >
              {notification.level}
            </span>
            <span aria-hidden="true">•</span>
            <span className="text-muted-foreground normal-case tracking-normal">
              {formatTimestamp(notification.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

export default NotificationCard
