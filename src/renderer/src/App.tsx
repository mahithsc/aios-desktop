import { useEffect, type JSX } from 'react'
import ChatInput from './components/ChatInput'
import { useChatStore } from './store/useChatSessionStore'
import Messages from './components/Message'
import Home from './pages/home/Home'

const App = (): JSX.Element => {
  // const newChat = useChatStore((state) => state.newChat)
  // const chat = useChatStore((state) => state.chat)
  // const addAssistantMessageEvent = useChatStore((state) => state.addAssistantMessageEvent)

  // useEffect(() => {
  //   return window.api.onSocketEvent((socketEvent) => {
  //     if (socketEvent.type !== 'chat') {
  //       return
  //     }

  //     addAssistantMessageEvent(socketEvent.data)
  //   })
  // }, [addAssistantMessageEvent])

  // return (
  //   <div className="space-y-3 p-6">
  //     <ChatInput />
  //     <button onClick={() => newChat()}>New Chat</button>
  //     <Messages messages={chat.messages} />
  //   </div>
  // )
  return (
    <Home/>
  )
}

export default App
