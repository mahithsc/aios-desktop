import type { JSX } from 'react'

const NOTIFICATIONS_ENABLED = false

type OverlayNotification = {
  id: string
  title: string
  subtitle: string
  imageUrl: string
  imageAlt: string
}

const notifications: OverlayNotification[] = [
  {
    id: 'steve-jobs',
    title: 'Steve Jobs',
    subtitle: 'Walter Isaacson',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/e/e4/Steve_Jobs_by_Walter_Isaacson.jpg',
    imageAlt: 'Steve Jobs book cover'
  },
  {
    id: 'second',
    title: 'Second notification',
    subtitle: 'Click test area',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/e/e4/Steve_Jobs_by_Walter_Isaacson.jpg',
    imageAlt: 'Steve Jobs book cover'
  },
  {
    id: 'third',
    title: 'Third notification',
    subtitle: 'Dynamic resize test',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/e/e4/Steve_Jobs_by_Walter_Isaacson.jpg',
    imageAlt: 'Steve Jobs book cover'
  }
]

const NotificationCard = ({ notification }: { notification: OverlayNotification }): JSX.Element => (
  <button
    type="button"
    onClick={() => window.api.logToConsole('info', 'Notification clicked', notification)}
    className="flex h-24 w-full items-center gap-3 rounded-xl border border-white/10 bg-neutral-950/90 px-3 text-left shadow-2xl shadow-black/35 backdrop-blur-md"
  >
    <img
      src={notification.imageUrl}
      alt={notification.imageAlt}
      className="h-16 w-16 rounded-lg object-cover"
    />
    <div className="min-w-0 text-white">
      <div className="truncate text-sm font-normal leading-5">{notification.title}</div>
      <div className="truncate text-xs font-normal leading-5 text-white/64">
        {notification.subtitle}
      </div>
    </div>
  </button>
)

const OverlayApp = (): JSX.Element => {
  if (!NOTIFICATIONS_ENABLED) {
    return <div className="pointer-events-none fixed inset-0" />
  }

  return (
    <div className="flex w-80 flex-col gap-2">
      {notifications.map((notification) => (
        <NotificationCard key={notification.id} notification={notification} />
      ))}
    </div>
  )
}

export default OverlayApp
