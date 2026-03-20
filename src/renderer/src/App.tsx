import { useEffect, useState, type JSX } from 'react'
import MainWindow from '@renderer/windows/main/MainWindow'
import OverlayWindow from '@renderer/windows/overlay/OverlayWindow'
import { useChatStore } from './store/useChatSessionStore'

const App = (): JSX.Element => {
  const addAssistantMessageEvent = useChatStore((state) => state.addAssistantMessageEvent)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)

  useEffect(() => {
    return window.api.onSocketEvent((socketEvent) => {
      if (socketEvent.type !== 'chat') {
        return
      }

      addAssistantMessageEvent(socketEvent.data)
    })
  }, [addAssistantMessageEvent])

  return (
    <>
      <MainWindow isOverlayOpen={isOverlayOpen} onOpenOverlay={() => setIsOverlayOpen(true)} />
      <OverlayWindow isOpen={isOverlayOpen} onClose={() => setIsOverlayOpen(false)} />
    </>
  )
}

export default App
