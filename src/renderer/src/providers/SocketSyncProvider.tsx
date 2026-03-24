import { useEffect, type ReactNode } from 'react'
import {
  isChat,
  isChatHistory,
  isLLMEvent,
  isNotification,
  isNotificationListResponse,
  isRun,
  isRunEvent
} from '../lib/socketEventGuards'
import { runEventToChatEvent } from '../lib/runEventToChatEvent'
import { useChatStore } from '../store/useChatSessionStore'
import { useNotificationStore } from '../store/useNotificationStore'

type SocketSyncProviderProps = {
  children: ReactNode
}

const SocketSyncProvider = ({ children }: SocketSyncProviderProps): ReactNode => {
  const addAssistantMessageEvent = useChatStore((state) => state.addAssistantMessageEvent)
  const bindAssistantRun = useChatStore((state) => state.bindAssistantRun)
  const setChat = useChatStore((state) => state.setChat)
  const setChatHistory = useChatStore((state) => state.setChatHistory)
  const addNotification = useNotificationStore((state) => state.addNotification)
  const dismissNotification = useNotificationStore((state) => state.dismissNotification)
  const setNotifications = useNotificationStore((state) => state.setNotifications)

  useEffect(() => {
    window.api.sendSocketMessage({
      type: 'chat-history',
      data: null
    })
    window.api.sendSocketMessage({
      type: 'notification.list',
      data: null
    })
  }, [])

  useEffect(() => {
    return window.api.onSocketEvent((socketEvent) => {
      if (socketEvent.type === 'chat-history') {
        if (isChatHistory(socketEvent.data)) {
          setChatHistory(socketEvent.data)
        } else if (isChat(socketEvent.data)) {
          setChat(socketEvent.data)
        } else {
          setChatHistory([])
        }
        return
      }

      if (socketEvent.type === 'chat' && isLLMEvent(socketEvent.data)) {
        addAssistantMessageEvent('legacy-chat-stream', socketEvent.data)
        return
      }

      if (socketEvent.type === 'notification.list') {
        if (isNotificationListResponse(socketEvent.data)) {
          setNotifications(socketEvent.data.notifications)
        } else {
          setNotifications([])
        }
        return
      }

      if (socketEvent.type === 'notification.created' && isNotification(socketEvent.data)) {
        addNotification(socketEvent.data)
        return
      }

      if (socketEvent.type === 'notification.dismiss' && isNotification(socketEvent.data)) {
        dismissNotification(socketEvent.data.id)
        return
      }

      if (socketEvent.type === 'run.accepted' && isRun(socketEvent.data)) {
        if (
          socketEvent.data.chatId === useChatStore.getState().chat.id &&
          socketEvent.data.turnId
        ) {
          bindAssistantRun(socketEvent.data.turnId, socketEvent.data.id)
        }
        return
      }

      if (socketEvent.type !== 'run.event' || !isRunEvent(socketEvent.data)) {
        return
      }

      if (socketEvent.data.chatId !== useChatStore.getState().chat.id) {
        return
      }

      const chatEvent = runEventToChatEvent(socketEvent.data)
      if (chatEvent) {
        addAssistantMessageEvent(socketEvent.data.runId, chatEvent)
      }
    })
  }, [
    addAssistantMessageEvent,
    addNotification,
    bindAssistantRun,
    dismissNotification,
    setChat,
    setChatHistory,
    setNotifications
  ])

  return children
}

export default SocketSyncProvider
