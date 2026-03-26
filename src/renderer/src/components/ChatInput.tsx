import type { JSX, KeyboardEventHandler } from 'react'
import Input from './Input'
import { useInputStore } from '../store/useInputStore'
import { useChatStore } from '../store/useChatSessionStore'

const ChatInput = (): JSX.Element => {
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || !value.trim()) {
      return
    }

    const turnId = crypto.randomUUID()
    addUserMessage(value)
    const chat = useChatStore.getState().chat
    createAssistantMessageStub(turnId)
    window.api.sendSocketMessage({
      type: 'chat.submit',
      data: {
        chat,
        turnId
      }
    })
    clearValue()
  }

  return (
    <Input
      placeholder="Enter text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
    />
  )
}

export default ChatInput
