import { useEffect, useState, type JSX } from 'react'
import MainWindow from '@renderer/windows/main/MainWindow'
import OverlayWindow from '@renderer/windows/overlay/OverlayWindow'
import type { Chat, ChatMetadata, LLMEvent } from 'src/shared/chat'
import type { Run, RunEvent } from 'src/shared/run'
import { useChatStore } from './store/useChatSessionStore'

const isLLMEvent = (value: unknown): value is LLMEvent =>
  typeof value === 'object' && value !== null && 'type' in value && 'createdAt' in value

const isChat = (value: unknown): value is Chat =>
  typeof value === 'object' && value !== null && 'id' in value && 'messages' in value

const isChatHistory = (value: unknown): value is ChatMetadata[] =>
  Array.isArray(value)

const isRunEvent = (value: unknown): value is RunEvent =>
  typeof value === 'object' && value !== null && 'runId' in value && 'event' in value

const isRun = (value: unknown): value is Run =>
  typeof value === 'object' && value !== null && 'id' in value && 'kind' in value

const toChatEvent = (runEvent: RunEvent): LLMEvent | null => {
  const { data } = runEvent.event
  const baseEvent = {
    id: `${runEvent.runId}:${runEvent.sequence}`,
    createdAt: runEvent.createdAt
  }

  if (runEvent.event.type === 'started') {
    return {
      ...baseEvent,
      type: 'stream_start'
    }
  }

  if (runEvent.event.type === 'token') {
    const value = data?.value
    if (typeof value !== 'string') {
      return null
    }

    return {
      ...baseEvent,
      type: 'token',
      value
    }
  }

  if (runEvent.event.type === 'tool_call_start') {
    const toolCallId = data?.toolCallId
    const toolName = data?.toolName
    if (typeof toolCallId !== 'string' || typeof toolName !== 'string') {
      return null
    }

    return {
      ...baseEvent,
      type: 'tool_call_start',
      toolCallId,
      toolName,
      input: data?.input
    }
  }

  if (runEvent.event.type === 'tool_call_end') {
    const toolCallId = data?.toolCallId
    const toolName = data?.toolName
    if (typeof toolCallId !== 'string' || typeof toolName !== 'string') {
      return null
    }

    return {
      ...baseEvent,
      type: 'tool_call_end',
      toolCallId,
      toolName,
      output: data?.output
    }
  }

  if (runEvent.event.type === 'error') {
    return {
      ...baseEvent,
      type: 'stream_error',
      error: typeof data?.error === 'string' ? data.error : 'Run failed.'
    }
  }

  if (runEvent.event.type === 'completed') {
    return {
      ...baseEvent,
      type: 'stream_end'
    }
  }

  return null
}

const App = (): JSX.Element => {
  const addAssistantMessageEvent = useChatStore((state) => state.addAssistantMessageEvent)
  const bindAssistantRun = useChatStore((state) => state.bindAssistantRun)
  const setChat = useChatStore((state) => state.setChat)
  const setChatHistory = useChatStore((state) => state.setChatHistory)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)

  useEffect(() => {
    window.api.sendSocketMessage({
      type: 'chat-history',
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

      if (socketEvent.type === 'run.accepted' && isRun(socketEvent.data)) {
        if (socketEvent.data.chatId === useChatStore.getState().chat.id && socketEvent.data.turnId) {
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

      const chatEvent = toChatEvent(socketEvent.data)
      if (chatEvent) {
        addAssistantMessageEvent(socketEvent.data.runId, chatEvent)
      }
    })
  }, [addAssistantMessageEvent, bindAssistantRun, setChat, setChatHistory])

  return (
    <>
      <MainWindow isOverlayOpen={isOverlayOpen} onOpenOverlay={() => setIsOverlayOpen(true)} />
      <OverlayWindow isOpen={isOverlayOpen} onClose={() => setIsOverlayOpen(false)} />
    </>
  )
}

export default App
