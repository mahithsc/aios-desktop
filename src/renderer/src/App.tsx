import { useEffect, useState, type JSX } from 'react'
import MainWindow from '@renderer/windows/main/MainWindow'
import OverlayWindow from '@renderer/windows/overlay/OverlayWindow'
import type { Chat, ChatMetadata, LLMEvent } from 'src/shared/chat'
import { useChatStore } from './store/useChatSessionStore'

const isLLMEvent = (value: unknown): value is LLMEvent =>
  typeof value === 'object' && value !== null && 'type' in value && 'createdAt' in value

const isChat = (value: unknown): value is Chat =>
  typeof value === 'object' && value !== null && 'id' in value && 'messages' in value

const isChatHistory = (value: unknown): value is ChatMetadata[] =>
  Array.isArray(value)

const App = (): JSX.Element => {
  const addAssistantMessageEvent = useChatStore((state) => state.addAssistantMessageEvent)
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

      if (socketEvent.type !== 'chat') {
        return
      }

      if (isLLMEvent(socketEvent.data)) {
        addAssistantMessageEvent(socketEvent.data)
      }
    })
  }, [addAssistantMessageEvent, setChat, setChatHistory])

  return (
    <>
      <MainWindow isOverlayOpen={isOverlayOpen} onOpenOverlay={() => setIsOverlayOpen(true)} />
      <OverlayWindow isOpen={isOverlayOpen} onClose={() => setIsOverlayOpen(false)} />
    </>
  )
}

export default App
