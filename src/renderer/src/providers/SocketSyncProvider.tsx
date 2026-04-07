import { useEffect, type ReactNode } from 'react'
import type { ChatStatus } from 'src/shared/chat'
import type { Run, RunEvent, RunStatus } from 'src/shared/run'
import { useCanvasStore } from '../features/canvas/store/useCanvasStore'
import { runEventToChatEvent } from '../features/chat/lib/runEventToChatEvent'
import { useChatStore } from '../features/chat/store/useChatSessionStore'
import { useCronStore } from '../features/crons/store/useCronStore'
import { useHeartbeatStore } from '../features/heartbeat/store/useHeartbeatStore'
import { useNotificationStore } from '../features/notifications/store/useNotificationStore'
import {
  getChatCanvasArtifact,
  isAssistant,
  isAssistantList,
  isChat,
  isChatHistory,
  isCronUpcomingListResponse,
  isLLMEvent,
  isNotification,
  isNotificationListResponse,
  isRun,
  isRunEvent,
  isRunSnapshotList
} from '../shared/lib/socketEventGuards'
import { useAssistantStore } from '../store/useAssistantStore'
import { useSocketStore } from '../shared/store/socketStore'

const CRON_REFRESH_INTERVAL_MS = 30_000

type SocketSyncProviderProps = {
  children: ReactNode
}

const requestHeartbeatSnapshots = (): void => {
  window.api.sendSocketMessage({
    type: 'process.snapshot.list',
    data: {
      kinds: ['heartbeat'],
      limit: 6
    }
  })
}

const getChatStatusFromRunStatus = (status: RunStatus): ChatStatus => {
  if (status === 'completed') return 'idle'
  if (status === 'error') return 'error'
  if (status === 'cancelled') return 'cancelled'
  return 'streaming'
}

const getChatStatusFromRunEvent = (event: RunEvent): ChatStatus => {
  if (event.event.type === 'completed') return 'idle'
  if (event.event.type === 'error') return 'error'
  if (event.event.type === 'cancelled') return 'cancelled'
  return 'streaming'
}

const getPreviewText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 160) : undefined
}

const getChatPreviewFromRunEvent = (event: RunEvent): string | null | undefined => {
  const data = event.event.data ?? {}

  if (event.event.type === 'progress') {
    return getPreviewText(data.message)
  }

  if (event.event.type === 'error') {
    return getPreviewText(data.error) ?? 'Run failed.'
  }

  if (event.event.type === 'cancelled') {
    return getPreviewText(data.reason) ?? 'Run stopped.'
  }

  return undefined
}

const getChatActiveStepFromRun = (run: Run): string | null => {
  if (run.status === 'queued') return 'queued'
  if (run.status === 'running') return 'running'
  return null
}

const getChatActiveStepFromRunEvent = (event: RunEvent): string | null | undefined => {
  if (
    event.event.type === 'completed' ||
    event.event.type === 'error' ||
    event.event.type === 'cancelled'
  ) {
    return null
  }

  const toolName = event.event.data?.toolName
  if (event.event.type === 'tool_call_start' && typeof toolName === 'string' && toolName.trim()) {
    return toolName.trim()
  }

  if (event.event.type === 'started') {
    return 'thinking'
  }

  if (event.event.type === 'subagent_tool_event') {
    return 'subagent'
  }

  return undefined
}

const SocketSyncProvider = ({ children }: SocketSyncProviderProps): ReactNode => {
  const addAssistantMessageEvent = useChatStore((state) => state.addAssistantMessageEvent)
  const bindAssistantRun = useChatStore((state) => state.bindAssistantRun)
  const setChat = useChatStore((state) => state.setChat)
  const setChatHistory = useChatStore((state) => state.setChatHistory)
  const updateChatMetadata = useChatStore((state) => state.updateChatMetadata)
  const setCanvasArtifact = useCanvasStore((state) => state.setCanvasArtifact)
  const setAssistants = useAssistantStore((state) => state.setAssistants)
  const upsertAssistant = useAssistantStore((state) => state.upsertAssistant)
  const setUpcomingCrons = useCronStore((state) => state.setUpcomingCrons)
  const acceptHeartbeatRun = useHeartbeatStore((state) => state.acceptRun)
  const applyHeartbeatEvent = useHeartbeatStore((state) => state.applyEvent)
  const applyHeartbeatEvents = useHeartbeatStore((state) => state.applyEvents)
  const setHeartbeatSnapshots = useHeartbeatStore((state) => state.setSnapshots)
  const addNotification = useNotificationStore((state) => state.addNotification)
  const dismissNotification = useNotificationStore((state) => state.dismissNotification)
  const setNotifications = useNotificationStore((state) => state.setNotifications)
  const connectionState = useSocketStore((state) => state.connectionState)
  const setConnectionState = useSocketStore((state) => state.setConnectionState)

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
    requestHeartbeatSnapshots()
  }, [])

  useEffect(() => window.api.onSocketStateChange(setConnectionState), [setConnectionState])

  useEffect(() => {
    if (connectionState === 'connected') {
      requestHeartbeatSnapshots()
    }
  }, [connectionState])

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

      if (socketEvent.type === 'process.snapshot.list' && isRunSnapshotList(socketEvent.data)) {
        setHeartbeatSnapshots(socketEvent.data)
        return
      }

      if (socketEvent.type === 'run.accepted' && isRun(socketEvent.data)) {
        acceptHeartbeatRun(socketEvent.data)
        if (socketEvent.data.kind === 'chat' && socketEvent.data.chatId) {
          updateChatMetadata({
            chatId: socketEvent.data.chatId,
            updatedAt: socketEvent.data.updatedAt,
            status: getChatStatusFromRunStatus(socketEvent.data.status),
            activeRunId: socketEvent.data.id,
            activeStep: getChatActiveStepFromRun(socketEvent.data),
            preview: null
          })
        }
        if (
          socketEvent.data.chatId === useChatStore.getState().chat.id &&
          socketEvent.data.turnId
        ) {
          bindAssistantRun(socketEvent.data.turnId, socketEvent.data.id)
        }
        return
      }

      if (socketEvent.type === 'run.resume' && Array.isArray(socketEvent.data)) {
        applyHeartbeatEvents(socketEvent.data.filter(isRunEvent))
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

      if (socketEvent.data.kind === 'heartbeat') {
        applyHeartbeatEvent(socketEvent.data)
        return
      }

      if (socketEvent.data.chatId) {
        updateChatMetadata({
          chatId: socketEvent.data.chatId,
          updatedAt: socketEvent.data.createdAt,
          status: getChatStatusFromRunEvent(socketEvent.data),
          activeRunId:
            socketEvent.data.event.type === 'completed' ||
            socketEvent.data.event.type === 'error' ||
            socketEvent.data.event.type === 'cancelled'
              ? null
              : socketEvent.data.runId,
          activeStep: getChatActiveStepFromRunEvent(socketEvent.data),
          preview: getChatPreviewFromRunEvent(socketEvent.data)
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
        window.api.logToConsole(
          'debug',
          '[canvas] Writing canvas artifact from socket event into store.',
          {
            chatId: canvasArtifact.chatId,
            runId: canvasArtifact.runId,
            toolCallId: canvasArtifact.toolCallId,
            artifact: canvasArtifact.artifact
          }
        )
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
    applyHeartbeatEvent,
    applyHeartbeatEvents,
    acceptHeartbeatRun,
    bindAssistantRun,
    dismissNotification,
    setCanvasArtifact,
    setAssistants,
    setChat,
    setChatHistory,
    setHeartbeatSnapshots,
    setUpcomingCrons,
    setNotifications,
    updateChatMetadata,
    upsertAssistant
  ])

  return children
}

export default SocketSyncProvider
