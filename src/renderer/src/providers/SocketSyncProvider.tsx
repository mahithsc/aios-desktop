import { useEffect, type ReactNode } from 'react'
import {
  isAssistant,
  isAssistantList,
  getChatCanvasArtifact,
  isChat,
  isChatHistory,
  isCronUpcomingListResponse,
  isLLMEvent,
  isNotification,
  isNotificationListResponse,
  isRun,
  isRunEvent
} from '../lib/socketEventGuards'
import { runEventToChatEvent } from '../lib/runEventToChatEvent'
import { useCanvasStore } from '../store/useCanvasStore'
import { useAssistantStore } from '../store/useAssistantStore'
import { useChatStore } from '../store/useChatSessionStore'
import { useCronStore } from '../store/useCronStore'
import { useNotificationStore } from '../store/useNotificationStore'

const CRON_REFRESH_INTERVAL_MS = 30_000

type SocketSyncProviderProps = {
  children: ReactNode
}

const SocketSyncProvider = ({ children }: SocketSyncProviderProps): ReactNode => {
  const addAssistantMessageEvent = useChatStore((state) => state.addAssistantMessageEvent)
  const bindAssistantRun = useChatStore((state) => state.bindAssistantRun)
  const setChat = useChatStore((state) => state.setChat)
  const setChatHistory = useChatStore((state) => state.setChatHistory)
  const setCanvasArtifact = useCanvasStore((state) => state.setCanvasArtifact)
  const setAssistants = useAssistantStore((state) => state.setAssistants)
  const upsertAssistant = useAssistantStore((state) => state.upsertAssistant)
  const setUpcomingCrons = useCronStore((state) => state.setUpcomingCrons)
  const addNotification = useNotificationStore((state) => state.addNotification)
  const dismissNotification = useNotificationStore((state) => state.dismissNotification)
  const setNotifications = useNotificationStore((state) => state.setNotifications)

  useEffect(() => {
    window.api.sendSocketMessage({
      type: 'assistant.list',
      data: null
    })
    window.api.sendSocketMessage({
      type: 'chat-history',
      data: null
    })
    window.api.sendSocketMessage({
      type: 'notification.list',
      data: null
    })
    window.api.sendSocketMessage({
      type: 'cron.upcoming.list',
      data: null
    })
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      window.api.sendSocketMessage({
        type: 'cron.upcoming.list',
        data: null
      })
    }, CRON_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
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

      if (socketEvent.type === 'assistant.list') {
        if (isAssistantList(socketEvent.data)) {
          setAssistants(socketEvent.data)
        } else {
          setAssistants([])
        }
        return
      }

      if (socketEvent.type === 'assistant.init' && isAssistant(socketEvent.data)) {
        upsertAssistant(socketEvent.data)
        window.api.sendSocketMessage({
          type: 'chat-history',
          data: null
        })
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

      if (socketEvent.type === 'cron.upcoming.list') {
        if (isCronUpcomingListResponse(socketEvent.data)) {
          setUpcomingCrons(socketEvent.data.crons)
        } else {
          setUpcomingCrons([])
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

      console.debug('[canvas]', 'Received run.event socket payload.', {
        runId: socketEvent.data.runId,
        sequence: socketEvent.data.sequence,
        chatId: socketEvent.data.chatId,
        currentChatId: useChatStore.getState().chat.id,
        eventType: socketEvent.data.event.type,
        toolName: socketEvent.data.event.data?.toolName,
        toolCallId: socketEvent.data.event.data?.toolCallId,
        output: socketEvent.data.event.data?.output
      })
      window.api.logToConsole('debug', '[canvas] Received run.event socket payload.', {
        runId: socketEvent.data.runId,
        sequence: socketEvent.data.sequence,
        chatId: socketEvent.data.chatId,
        currentChatId: useChatStore.getState().chat.id,
        eventType: socketEvent.data.event.type,
        toolName: socketEvent.data.event.data?.toolName,
        toolCallId: socketEvent.data.event.data?.toolCallId,
        output: socketEvent.data.event.data?.output
      })

      if (
        socketEvent.data.event.type === 'tool_call_end' &&
        socketEvent.data.event.data?.toolName === 'assistant'
      ) {
        window.api.sendSocketMessage({
          type: 'assistant.list',
          data: null
        })
        window.api.sendSocketMessage({
          type: 'chat-history',
          data: null
        })
      }

      if (socketEvent.data.chatId !== useChatStore.getState().chat.id) {
        console.debug('[canvas]', 'Ignoring run.event for inactive chat.', {
          runEventChatId: socketEvent.data.chatId,
          currentChatId: useChatStore.getState().chat.id,
          runId: socketEvent.data.runId,
          sequence: socketEvent.data.sequence
        })
        window.api.logToConsole('debug', '[canvas] Ignoring run.event for inactive chat.', {
          runEventChatId: socketEvent.data.chatId,
          currentChatId: useChatStore.getState().chat.id,
          runId: socketEvent.data.runId,
          sequence: socketEvent.data.sequence
        })
        return
      }

      const canvasArtifact = getChatCanvasArtifact(socketEvent.data)
      if (canvasArtifact) {
        console.debug('[canvas]', 'Writing canvas artifact from socket event into store.', {
          chatId: canvasArtifact.chatId,
          runId: canvasArtifact.runId,
          toolCallId: canvasArtifact.toolCallId,
          artifact: canvasArtifact.artifact
        })
        window.api.logToConsole('debug', '[canvas] Writing canvas artifact from socket event into store.', {
          chatId: canvasArtifact.chatId,
          runId: canvasArtifact.runId,
          toolCallId: canvasArtifact.toolCallId,
          artifact: canvasArtifact.artifact
        })
        setCanvasArtifact(canvasArtifact)
      } else {
        console.debug('[canvas]', 'No canvas artifact extracted from run event.', {
          runId: socketEvent.data.runId,
          sequence: socketEvent.data.sequence,
          eventType: socketEvent.data.event.type,
          toolName: socketEvent.data.event.data?.toolName
        })
        window.api.logToConsole('debug', '[canvas] No canvas artifact extracted from run event.', {
          runId: socketEvent.data.runId,
          sequence: socketEvent.data.sequence,
          eventType: socketEvent.data.event.type,
          toolName: socketEvent.data.event.data?.toolName
        })
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
    setCanvasArtifact,
    setAssistants,
    setChat,
    setChatHistory,
    setUpcomingCrons,
    setNotifications,
    upsertAssistant
  ])

  return children
}

export default SocketSyncProvider
