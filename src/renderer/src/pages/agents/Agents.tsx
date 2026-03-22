import type { ChatMetadata } from 'src/shared/chat'
import { useMemo, type JSX, type KeyboardEvent } from 'react'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'
import ChatMessages from '../../components/ChatMessages'
import ChatComposer from './components/ChatComposer'

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(timestamp)

const getChatTitle = (chat: ChatMetadata): string => chat.title?.trim() || 'Untitled chat'

const ChatHistoryItem = ({
  title,
  subtitle,
  isActive,
  onClick
}: {
  title: string
  subtitle: string
  isActive: boolean
  onClick: () => void
}): JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    aria-current={isActive ? 'page' : undefined}
    className={`block w-full rounded-lg px-2 py-2 text-left transition ${
      isActive ? 'bg-stone-100' : 'hover:bg-stone-100'
    }`}
  >
    <div className="truncate text-sm text-stone-900">{title}</div>
    <div className="mt-1 truncate text-xs text-stone-500">{subtitle}</div>
  </button>
)

const Agents = (): JSX.Element => {
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const chat = useChatStore((state) => state.chat)
  const chatHistory = useChatStore((state) => state.chatHistory)
  const newChat = useChatStore((state) => state.newChat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)

  const previousChats = useMemo(
    () => [...chatHistory].sort((a, b) => b.updatedAt - a.updatedAt),
    [chatHistory]
  )

  const handleSubmit = (): void => {
    const nextValue = value.trim()

    if (!nextValue) {
      return
    }

    addUserMessage(nextValue)
    window.api.sendSocketMessage({
      type: 'chat',
      data: useChatStore.getState().chat
    })
    createAssistantMessageStub()
    clearValue()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.shiftKey) {
      return
    }

    event.preventDefault()
    handleSubmit()
  }

  const handleLoadChat = (chatId: string): void => {
    window.api.sendSocketMessage({
      type: 'chat-history',
      data: chatId
    })
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r border-stone-200 bg-white">
        <div className="px-4 pb-0 pt-10">
          <button
            type="button"
            onClick={newChat}
            className="flex w-full items-center justify-center rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:bg-stone-50"
          >
            <span className="inline-flex items-center gap-1.5">
              <span>+</span>
              <span>New Chat</span>
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {previousChats.length > 0 ? (
            previousChats.map((historyChat) => (
              <ChatHistoryItem
                key={historyChat.id}
                title={getChatTitle(historyChat)}
                subtitle={`Updated ${formatTimestamp(historyChat.updatedAt)}`}
                isActive={historyChat.id === chat.id}
                onClick={() => handleLoadChat(historyChat.id)}
              />
            ))
          ) : (
            <div className="px-2 py-4 text-sm text-stone-500">
              Your past chats will appear here.
            </div>
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-hidden pt-14 sm:pt-18">
        <div className="relative mx-auto flex h-full min-h-0 w-full max-w-184 flex-col overflow-hidden">
          <div className="flex-1 min-h-0 space-y-8 overflow-y-auto px-4 sm:px-6">
            <ChatMessages messages={chat.messages} bottomSpacerClassName="h-28 sm:h-32" />
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-white sm:h-16" />
            <div className="relative px-4 pb-4 sm:px-6 sm:pb-6">
              <ChatComposer
                value={value}
                onChange={setValue}
                onKeyDown={handleKeyDown}
                onSubmit={handleSubmit}
                fixed={false}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Agents
