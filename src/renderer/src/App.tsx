import type { JSX, KeyboardEventHandler } from 'react'
import Input from './components/Input'
import { useInputStore } from './store/useInputStore'
import { useChatStore } from './store/useChatSessionStore'

const App = (): JSX.Element => {
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const newChat = useChatStore((state) => state.newChat)
  const chat = useChatStore((state) => state.chat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const clearValue = useInputStore((state) => state.clearValue)

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    addUserMessage(value)
    window.api.sendChat(useChatStore.getState().chat)
    clearValue()
    createAssistantMessageStub()
  }

  return (
    <div className="space-y-3 p-6">
      <Input
        placeholder="Enter text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <p className="text-sm text-gray-600">Current value: {value || 'Nothing typed yet.'}</p>

      <button onClick={() => newChat()}>New Chat</button>

      <pre>{JSON.stringify(chat, null, 2)}</pre>
    </div>
  )
}

export default App
