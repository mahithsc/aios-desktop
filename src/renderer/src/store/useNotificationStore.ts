import type { Notification } from 'src/shared/notification'
import { create } from 'zustand'

const sortNotifications = (notifications: Notification[]): Notification[] =>
  [...notifications].sort((left, right) => right.createdAt - left.createdAt)

const upsertNotifications = (
  currentNotifications: Notification[],
  incomingNotifications: Notification[]
): Notification[] => {
  const notificationsById = new Map(currentNotifications.map((notification) => [notification.id, notification]))

  for (const notification of incomingNotifications) {
    notificationsById.set(notification.id, notification)
  }

  return sortNotifications([...notificationsById.values()])
}

interface NotificationStore {
  notifications: Notification[]
  queuedToastIds: string[]
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  addNotifications: (notifications: Notification[]) => void
  dismissNotification: (notificationId: string) => void
  dequeueToast: () => string | null
  clearQueuedToast: (notificationId: string) => void
  reset: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  queuedToastIds: [],

  setNotifications: (notifications) =>
    set((state) => {
      const nextNotifications = sortNotifications(notifications)
      const nextNotificationIds = new Set(nextNotifications.map((notification) => notification.id))
      const nextQueuedToastIds = state.queuedToastIds.filter((notificationId) =>
        nextNotificationIds.has(notificationId)
      )

      return {
        notifications: nextNotifications,
        queuedToastIds: nextQueuedToastIds
      }
    }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: upsertNotifications(state.notifications, [notification]),
      queuedToastIds: state.queuedToastIds.includes(notification.id)
        ? state.queuedToastIds
        : [...state.queuedToastIds, notification.id]
    })),

  addNotifications: (notifications) =>
    set((state) => {
      const nextNotifications = upsertNotifications(state.notifications, notifications)
      const incomingIds = notifications.map((notification) => notification.id)
      const nextQueuedToastIds = [...state.queuedToastIds]

      for (const notificationId of incomingIds) {
        if (!nextQueuedToastIds.includes(notificationId)) {
          nextQueuedToastIds.push(notificationId)
        }
      }

      return {
        notifications: nextNotifications,
        queuedToastIds: nextQueuedToastIds
      }
    }),

  dismissNotification: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== notificationId),
      queuedToastIds: state.queuedToastIds.filter((queuedId) => queuedId !== notificationId)
    })),

  dequeueToast: () => {
    let nextToastId: string | null = null

    set((state) => {
      nextToastId = state.queuedToastIds[0] ?? null

      return nextToastId === null
        ? state
        : {
            queuedToastIds: state.queuedToastIds.slice(1)
          }
    })

    return nextToastId
  },

  clearQueuedToast: (notificationId) =>
    set((state) => ({
      queuedToastIds: state.queuedToastIds.filter((queuedId) => queuedId !== notificationId)
    })),

  reset: () =>
    set({
      notifications: [],
      queuedToastIds: []
    })
}))
