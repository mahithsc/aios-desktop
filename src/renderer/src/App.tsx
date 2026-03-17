import { useEffect, type JSX } from 'react'
import AppLayout from '@renderer/AppLayout'
import { useChatStore } from './store/useChatSessionStore'

const App = (): JSX.Element => {
  const addAssistantMessageEvent = useChatStore((state) => state.addAssistantMessageEvent)

  useEffect(() => {
    return window.api.onSocketEvent((socketEvent) => {
      if (socketEvent.type !== 'chat') {
        return
      }

      addAssistantMessageEvent(socketEvent.data)
    })
  }, [addAssistantMessageEvent])

  return <AppLayout />
}

export default App
