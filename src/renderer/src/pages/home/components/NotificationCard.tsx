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
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }

  if (level === 'warning') {
    return 'bg-amber-50 text-amber-700 ring-amber-200'
  }

  if (level === 'error') {
    return 'bg-red-50 text-red-700 ring-red-200'
  }

  return 'bg-sky-50 text-sky-700 ring-sky-200'
}

type NotificationCardProps = {
  notification: Notification
  onDismiss: (notificationId: string) => void
}

const NotificationCard = ({ notification, onDismiss }: NotificationCardProps): JSX.Element => {
  return (
    <article className="group relative h-full rounded-2xl border border-stone-200 bg-white px-3 py-3 shadow-sm transition hover:border-stone-300 hover:bg-stone-50">
      <button
        type="button"
        aria-label={`Dismiss ${notification.title}`}
        onClick={() => onDismiss(notification.id)}
        className="absolute -left-2 -top-2 rounded-full border border-stone-200 bg-white px-2 py-1 text-xs leading-none text-stone-400 opacity-0 shadow-sm transition hover:bg-stone-100 hover:text-stone-700 focus-visible:opacity-100 group-hover:opacity-100"
      >
        x
      </button>

      <div className="flex h-full items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-stone-900">{notification.title}</div>
            <div className="mt-1 max-h-16 overflow-hidden text-xs leading-5 text-stone-600">
              {notification.body}
            </div>
          </div>

          <div className="mt-auto pt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-stone-400">
            <span
              className={`rounded-full px-2 py-0.5 font-medium ring-1 ${getLevelClassName(notification.level)}`}
            >
              {notification.level}
            </span>
            <span aria-hidden="true">•</span>
            <span className="text-stone-500 normal-case tracking-normal">
              {formatTimestamp(notification.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

export default NotificationCard
