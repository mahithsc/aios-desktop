import type { JSX } from 'react'
import type { Notification, NotificationLevel } from 'src/shared/notification'
import { useNotificationStore } from '../store/useNotificationStore'

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(timestamp)

const levelStyles: Record<NotificationLevel, string> = {
  info: 'border-stone-200 bg-white text-stone-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  error: 'border-red-200 bg-red-50 text-red-950'
}

const levelBadgeStyles: Record<NotificationLevel, string> = {
  info: 'bg-stone-100 text-stone-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700'
}

const dismissNotification = (notificationId: string): void => {
  window.api.sendSocketMessage({
    type: 'notification.dismiss',
    data: { id: notificationId }
  })
}

const NotificationCard = ({ notification }: { notification: Notification }): JSX.Element => (
  <div
    className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${levelStyles[notification.level]}`}
  >
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${levelBadgeStyles[notification.level]}`}
          >
            {notification.level}
          </span>
          <span className="text-stone-400">{formatTimestamp(notification.createdAt)}</span>
        </div>
        <div className="mt-2 text-sm font-medium">{notification.title}</div>
        <div className="mt-1 whitespace-pre-wrap text-sm leading-5 text-stone-600">
          {notification.body}
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismissNotification(notification.id)}
        className="rounded-full px-2 py-1 text-xs text-stone-500 transition hover:bg-black/5 hover:text-stone-900"
      >
        Dismiss
      </button>
    </div>
  </div>
)

const NotificationStack = (): JSX.Element | null => {
  const notifications = useNotificationStore((state) => state.notifications)

  if (notifications.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-end px-4">
      <div className="w-full max-w-sm space-y-3">
        {notifications.slice(0, 5).map((notification) => (
          <NotificationCard key={notification.id} notification={notification} />
        ))}
      </div>
    </div>
  )
}

export default NotificationStack
