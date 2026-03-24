import type { JSX, KeyboardEvent } from 'react'
import type { ChatMetadata } from 'src/shared/chat'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'
import { useNotificationStore } from '../../store/useNotificationStore'
import ChatComposer from '../agents/components/ChatComposer'
import NotificationCard from './components/NotificationCard'

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(timestamp)

const getStatusLabel = (status?: ChatMetadata['status']): string => {
  if (status === 'streaming') return 'Running'
  if (status === 'error') return 'Error'
  return 'Idle'
}

const getStatusClassName = (status?: ChatMetadata['status']): string => {
  if (status === 'streaming') {
    return 'bg-amber-100 text-amber-700'
  }

  if (status === 'error') {
    return 'bg-red-100 text-red-700'
  }

  return 'bg-stone-100 text-stone-600'
}

const ChatHistoryCard = ({
  chat,
  onClick
}: {
  chat: ChatMetadata
  onClick: () => void
}): JSX.Element => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-stone-50"
    >
      <div className="truncate text-sm font-medium text-stone-900">
        {chat.title?.trim() || 'Untitled chat'}
      </div>
      <div className="mt-1 text-xs text-stone-500">Updated {formatTimestamp(chat.updatedAt)}</div>
      <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-400">
        <span
          className={`rounded-full px-2 py-0.5 font-medium tracking-[0.08em] ${getStatusClassName(chat.status)}`}
        >
          {getStatusLabel(chat.status)}
        </span>
        <span aria-hidden="true">•</span>
        <span className="font-mono normal-case tracking-normal text-stone-500">
          {chat.id.slice(0, 8)}
        </span>
      </div>
    </button>
  )
}

type HomeProps = {
  onOpenAgents: () => void
}

const Home = ({ onOpenAgents }: HomeProps): JSX.Element => {
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const chatHistory = useChatStore((state) => state.chatHistory)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const notifications = useNotificationStore((state) => state.notifications)
  const dismissNotification = useNotificationStore((state) => state.dismissNotification)
  const recentChats = [...chatHistory].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)

  const handleSubmit = (): void => {
    const nextValue = value.trim()

    if (!nextValue) {
      return
    }

    const turnId = crypto.randomUUID()
    addUserMessage(nextValue)
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
    onOpenAgents()
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
    onOpenAgents()
  }

  const handleDismissNotification = (notificationId: string): void => {
    dismissNotification(notificationId)
    window.api.sendSocketMessage({
      type: 'notification.dismiss',
      data: {
        id: notificationId
      }
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-lg tracking-tight text-black sm:text-2xl">
          Hi, Mahith what are you working on
        </h1>
      </div>

      <ChatComposer
        value={value}
        onChange={setValue}
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
        fixed={false}
        placeholder="Ask anything"
      />

      <section className="w-full max-w-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-stone-900">Notifications</h2>
          <span className="text-xs text-stone-400">{notifications.length} active</span>
        </div>

        {notifications.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onDismiss={handleDismissNotification}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-500">
            No active notifications.
          </div>
        )}
      </section>

      <section className="w-full max-w-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-stone-900">Recent Chats</h2>
          <span className="text-xs text-stone-400">{chatHistory.length} stored</span>
        </div>

        {recentChats.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentChats.map((chat) => (
              <ChatHistoryCard key={chat.id} chat={chat} onClick={() => handleLoadChat(chat.id)} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-500">
            No previous chats yet.
          </div>
        )}
      </section>
    </div>
  )
}

export default Home
