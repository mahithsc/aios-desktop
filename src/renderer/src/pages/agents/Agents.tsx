import type { ChatMetadata } from 'src/shared/chat'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { useChatStore } from '../../store/useChatSessionStore'
import { useCanvasStore } from '../../store/useCanvasStore'
import { useInputStore } from '../../store/useInputStore'
import CanvasPanel from '../../components/CanvasPanel'
import ChatMessages from '../../components/ChatMessages'
import ChatComposer from './components/ChatComposer'
import { useChatAttachments } from '../../lib/chatAttachments'
import { useFileDropTarget } from '../../lib/fileDropTarget'

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
  if (status === 'cancelled') return 'Stopped'
  if (status === 'error') return 'Error'
  return 'Idle'
}

const getStatusClassName = (status?: ChatMetadata['status']): string => {
  if (status === 'streaming') {
    return 'bg-secondary text-secondary-foreground'
  }

  if (status === 'error') {
    return 'bg-red-500/15 text-red-200'
  }

  if (status === 'cancelled') {
    return 'bg-amber-500/15 text-amber-200'
  }

  return 'bg-muted text-muted-foreground'
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
      isActive ? 'bg-secondary' : 'hover:bg-accent'
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="truncate text-sm text-foreground">{title}</div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${getStatusClassName(status)}`}
      >
        {getStatusLabel(status)}
      </span>
    </div>
    <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div>
  </button>
)

const Agents = (): JSX.Element => {
  const contentRef = useRef<HTMLElement | null>(null)
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const chat = useChatStore((state) => state.chat)
  const chatHistory = useChatStore((state) => state.chatHistory)
  const newChat = useChatStore((state) => state.newChat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const canvasArtifact = useCanvasStore((state) => state.artifactsByChatId[chat.id])
  const { attachments, clearAttachments, isUploading, removeAttachment, uploadError, uploadFiles } =
    useChatAttachments(chat.id)
  const { isDragActive, onDragEnter, onDragLeave, onDragOver, onDrop } = useFileDropTarget({
    disabled: isUploading,
    onFilesDropped: uploadFiles
  })

  const previousChats = useMemo(
    () => [...chatHistory].sort((a, b) => b.updatedAt - a.updatedAt),
    [chatHistory]
  )
  const [canvasWidth, setCanvasWidth] = useState(480)
  const [isResizingCanvas, setIsResizingCanvas] = useState(false)
  const activeRunId = useMemo(() => {
    const activeMessage = [...chat.messages]
      .reverse()
      .find(
        (message) =>
          message.role === 'assistant' &&
          (message.status === 'pending' || message.status === 'streaming') &&
          !!message.runId
      )

    return activeMessage?.role === 'assistant' ? (activeMessage.runId ?? null) : null
  }, [chat.messages])
  const isRunning = chat.status === 'streaming'

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
    if (isRunning) {
      return
    }

    const nextValue = value.trim()

    if (!nextValue && attachments.length === 0) {
      return
    }

    const turnId = crypto.randomUUID()
    addUserMessage({ content: nextValue, attachments })
    const nextChat = useChatStore.getState().chat
    createAssistantMessageStub(turnId)
    window.api.sendSocketMessage({
      type: 'chat.submit',
      data: {
        chat: nextChat,
        turnId
      }
    })
    clearValue()
    clearAttachments()
  }

  const handleStop = (): void => {
    if (!activeRunId) {
      return
    }

    window.api.sendSocketMessage({
      type: 'run.stop',
      data: {
        runId: activeRunId
      }
    })
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

  const resizeCanvas = (clientX: number): void => {
    const bounds = contentRef.current?.getBoundingClientRect()
    if (!bounds) {
      return
    }

    const nextWidth = bounds.right - clientX
    const minWidth = 320
    const maxWidth = Math.max(400, bounds.width - 320)
    setCanvasWidth(Math.min(Math.max(nextWidth, minWidth), maxWidth))
  }

  const handleResizeStart = (event: ReactMouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setIsResizingCanvas(true)
    resizeCanvas(event.clientX)
  }

  const handleResizeMove = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (!isResizingCanvas) {
      return
    }

    resizeCanvas(event.clientX)
  }

  const handleResizeEnd = (): void => {
    setIsResizingCanvas(false)
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full overflow-hidden bg-background"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={(event) => {
        void onDrop(event)
      }}
    >
      {isResizingCanvas ? (
        <div
          className="absolute inset-0 z-40 cursor-col-resize"
          onMouseMove={handleResizeMove}
          onMouseUp={handleResizeEnd}
          onMouseLeave={handleResizeEnd}
        />
      ) : null}
      {isDragActive ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <div className="rounded-2xl border border-dashed border-primary/60 bg-card px-6 py-4 text-sm font-medium text-foreground shadow-lg">
            Drop files to attach
          </div>
        </div>
      ) : null}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="px-4 pb-0 pt-12 sm:pt-14">
          <button
            type="button"
            onClick={newChat}
            className="flex w-full items-center justify-center rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground transition hover:bg-accent"
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
            <div className="px-2 py-4 text-sm text-muted-foreground">
              Your past chats will appear here.
            </div>
          )}
        </div>
      </aside>

      <section ref={contentRef} className="flex min-w-0 flex-1 overflow-hidden">
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto w-full max-w-184 px-4 pb-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-sm font-medium text-foreground">
                  {getChatTitle(chat)}
                </h1>
                <div className="text-xs text-muted-foreground">
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
              <ChatMessages
                messages={chat.messages}
                bottomSpacerClassName="h-28 sm:h-32"
                darkMode
              />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-14 bg-background sm:h-16" />
            <div className="relative z-10 mx-auto w-full max-w-184 px-4 pb-4 sm:px-6 sm:pb-6">
              <ChatComposer
                value={value}
                onChange={setValue}
                onKeyDown={handleKeyDown}
                onSubmit={handleSubmit}
                onStop={handleStop}
                attachments={attachments}
                isUploading={isUploading}
                isRunning={isRunning}
                canStop={Boolean(activeRunId)}
                onFilesSelected={uploadFiles}
                onRemoveAttachment={removeAttachment}
                uploadError={uploadError}
                fixed={false}
              />
            </div>
          </div>
        </div>

        {canvasArtifact ? (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize canvas"
              onMouseDown={handleResizeStart}
              className="group relative z-10 w-2 shrink-0 cursor-col-resize bg-transparent"
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition group-hover:bg-foreground/40" />
            </div>
            <CanvasPanel artifact={canvasArtifact} width={canvasWidth} />
          </>
        ) : null}
      </section>
    </div>
  )
}

export default Agents
