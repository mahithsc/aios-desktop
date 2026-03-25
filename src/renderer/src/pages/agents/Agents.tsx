import type { ChatMetadata } from 'src/shared/chat'
import { useEffect, useMemo, type JSX, type KeyboardEvent } from 'react'
import CanvasPanel from '../../components/CanvasPanel'
import { useChatStore } from '../../store/useChatSessionStore'
import { useCanvasStore } from '../../store/useCanvasStore'
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

const ChatHistoryItem = ({
  title,
  subtitle,
  status,
  isActive,
  onClick
}: {
  title: string
  subtitle: string
  status?: ChatMetadata['status']
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
    <div className="flex items-center justify-between gap-2">
      <div className="truncate text-sm text-stone-900">{title}</div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${getStatusClassName(status)}`}
      >
        {getStatusLabel(status)}
      </span>
    </div>
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
  const canvasArtifact = useCanvasStore((state) => state.artifactsByChatId[chat.id])

  const previousChats = useMemo(
    () => [...chatHistory].sort((a, b) => b.updatedAt - a.updatedAt),
    [chatHistory]
  )

  useEffect(() => {
    console.debug('[canvas]', 'Agents page selected canvas artifact changed.', {
      activeChatId: chat.id,
      artifact: canvasArtifact,
      knownCanvasChatIds: Object.keys(useCanvasStore.getState().artifactsByChatId)
    })
    window.api.logToConsole('debug', '[canvas] Agents page selected canvas artifact changed.', {
      activeChatId: chat.id,
      artifact: canvasArtifact,
      knownCanvasChatIds: Object.keys(useCanvasStore.getState().artifactsByChatId)
    })
  }, [canvasArtifact, chat.id])

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
        <div className="px-4 pb-0 pt-12 sm:pt-14">
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
                status={historyChat.status}
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

      <section className="flex min-w-0 flex-1 overflow-hidden">
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto w-full max-w-184 px-4 pb-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-sm font-medium text-stone-900">
                  {getChatTitle(chat)}
                </h1>
                <div className="text-xs text-stone-500">
                  Updated {formatTimestamp(chat.updatedAt)}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] ${getStatusClassName(chat.status)}`}
              >
                {getStatusLabel(chat.status)}
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-184 px-4 sm:px-6">
              <ChatMessages messages={chat.messages} bottomSpacerClassName="h-28 sm:h-32" />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-14 bg-white sm:h-16" />
            <div className="relative z-10 mx-auto w-full max-w-184 px-4 pb-4 sm:px-6 sm:pb-6">
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

        <CanvasPanel artifact={canvasArtifact} />
      </section>
    </div>
  )
}

export default Agents
