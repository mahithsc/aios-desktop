import { useState, type JSX, type KeyboardEvent } from 'react'
import Input from '../../components/Input'
import { useChatStore } from '../../store/useChatSessionStore'
import type { AssistantMessage, ChatMessage, TokenEvent } from 'src/shared/chat'

const getAssistantText = (message: AssistantMessage): string => {
  return message.events
    .filter((event): event is TokenEvent => event.type === 'token')
    .map((event) => event.value)
    .join('')
}

const getMessageText = (message: ChatMessage): string => {
  if (message.role === 'user') {
    return message.content
  }

  return getAssistantText(message) || (message.status === 'error' ? 'The response failed.' : '...')
}

const Agents = (): JSX.Element => {
  const [value, setValue] = useState('')
  const chat = useChatStore((state) => state.chat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)

  const handleSubmit = (): void => {
    const nextValue = value.trim()

    if (!nextValue) {
      return
    }

    addUserMessage(nextValue)
    window.api.sendChat(useChatStore.getState().chat)
    createAssistantMessageStub()
    setValue('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    handleSubmit()
  }

  return (
    <div className="mx-auto flex min-h-[72vh] max-w-5xl flex-col rounded-[28px] border border-stone-200 bg-stone-50 p-5 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-400">Agents</p>
          <h2 className="mt-1 text-2xl font-normal tracking-tight text-stone-900">Chat</h2>
        </div>

        <div className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-500">
          Planner active
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {chat.messages.length === 0 ? (
          <div className="flex h-full min-h-64 items-center justify-center rounded-[24px] border border-dashed border-stone-200 bg-white px-6 text-sm text-stone-400">
            Start a chat from here or from the Home input.
          </div>
        ) : null}

        {chat.messages.map((message) => {
          const isAssistant = message.role === 'assistant'

          return (
            <div
              key={message.id}
              className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-2xl rounded-[24px] px-5 py-4 text-sm leading-7 ${
                  isAssistant
                    ? 'border border-stone-200 bg-white text-stone-700'
                    : 'bg-stone-900 text-white'
                }`}
              >
                {getMessageText(message)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-[24px] border border-stone-200 bg-white p-4">
        <Input
          placeholder="Message an agent..."
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className="border-stone-200 bg-white shadow-none"
        />
      </div>
    </div>
  )
}

export default Agents
