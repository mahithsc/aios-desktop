import type { CanvasArtifact, ChatCanvasArtifact } from 'src/shared/canvas'
import type { ChatMetadata } from 'src/shared/chat'
import { AppWindow, FileCode2, ImageIcon, Video } from 'lucide-react'
import { useMemo, type JSX, type KeyboardEvent } from 'react'
import { useChatStore } from '../../store/useChatSessionStore'
import { useCanvasStore } from '../../store/useCanvasStore'
import { useCronStore } from '../../store/useCronStore'
import { useInputStore } from '../../store/useInputStore'
import { useNotificationStore } from '../../store/useNotificationStore'
import ChatComposer from '../agents/components/ChatComposer'
import NotificationCard from './components/NotificationCard'
import UpcomingCronCard from './components/UpcomingCronCard'
import { useChatAttachments } from '../../lib/chatAttachments'
import { useFileDropTarget } from '../../lib/fileDropTarget'

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(timestamp)

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

const getChatTitle = (chat?: Pick<ChatMetadata, 'title'> | null): string =>
  chat?.title?.trim() || 'Untitled chat'

const getApplicationTitle = (artifact: CanvasArtifact, chat?: ChatMetadata): string =>
  artifact.title?.trim() || artifact.name?.trim() || getChatTitle(chat)

const getApplicationSubtitle = (artifact: CanvasArtifact): string =>
  artifact.filePath?.trim() || artifact.url?.trim() || 'Canvas artifact'

const getApplicationTypeLabel = (artifact: CanvasArtifact): string => {
  const lowerName = artifact.name?.toLowerCase()
  const lowerPath = artifact.filePath?.toLowerCase()

  if (lowerName?.endsWith('.html') || lowerPath?.endsWith('.html')) {
    return 'Web app'
  }

  if (artifact.kind === 'image') return 'Image'
  if (artifact.kind === 'video') return 'Video'
  return 'Prototype'
}

const ApplicationIcon = ({ artifact }: { artifact: CanvasArtifact }): JSX.Element => {
  const lowerName = artifact.name?.toLowerCase()
  const lowerPath = artifact.filePath?.toLowerCase()

  if (lowerName?.endsWith('.html') || lowerPath?.endsWith('.html')) {
    return <FileCode2 className="h-4 w-4" />
  }

  if (artifact.kind === 'image') {
    return <ImageIcon className="h-4 w-4" />
  }

  if (artifact.kind === 'video') {
    return <Video className="h-4 w-4" />
  }

  return <AppWindow className="h-4 w-4" />
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
      className="rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm transition hover:bg-accent"
    >
      <div className="truncate text-sm font-medium text-foreground">
        {chat.title?.trim() || 'Untitled chat'}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Updated {formatTimestamp(chat.updatedAt)}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span
          className={`rounded-full px-2 py-0.5 font-medium tracking-[0.08em] ${getStatusClassName(chat.status)}`}
        >
          {getStatusLabel(chat.status)}
        </span>
        <span aria-hidden="true">•</span>
        <span className="font-mono normal-case tracking-normal text-muted-foreground">
          {chat.id.slice(0, 8)}
        </span>
      </div>
    </button>
  )
}

const ApplicationCard = ({
  entry,
  chat,
  onClick
}: {
  entry: ChatCanvasArtifact
  chat?: ChatMetadata
  onClick: () => void
}): JSX.Element => {
  const { artifact } = entry

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border bg-card px-4 py-4 text-left shadow-sm transition hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <ApplicationIcon artifact={artifact} />
            <span>{getApplicationTypeLabel(artifact)}</span>
          </div>
          <div className="mt-2 truncate text-sm font-medium text-foreground">
            {getApplicationTitle(artifact, chat)}
          </div>
        </div>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
          Open
        </span>
      </div>
      <div className="mt-2 line-clamp-2 break-all text-xs text-muted-foreground">
        {getApplicationSubtitle(artifact)}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>Built {formatTimestamp(entry.createdAt)}</span>
        <span aria-hidden="true">•</span>
        <span className="truncate normal-case tracking-normal">{getChatTitle(chat)}</span>
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
  const chat = useChatStore((state) => state.chat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const chatHistory = useChatStore((state) => state.chatHistory)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const canvasArtifactsByChatId = useCanvasStore((state) => state.artifactsByChatId)
  const upcomingCrons = useCronStore((state) => state.upcomingCrons)
  const notifications = useNotificationStore((state) => state.notifications)
  const dismissNotification = useNotificationStore((state) => state.dismissNotification)
  const { attachments, clearAttachments, isUploading, removeAttachment, uploadError, uploadFiles } =
    useChatAttachments(chat.id)
  const { isDragActive, onDragEnter, onDragLeave, onDragOver, onDrop } = useFileDropTarget({
    disabled: isUploading,
    onFilesDropped: uploadFiles
  })
  const recentChats = [...chatHistory].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  const applications = useMemo(
    () =>
      Object.values(canvasArtifactsByChatId)
        .filter((entry): entry is ChatCanvasArtifact => Boolean(entry))
        .sort((left, right) => right.createdAt - left.createdAt),
    [canvasArtifactsByChatId]
  )
  const chatHistoryById = useMemo(
    () => new Map(chatHistory.map((entry) => [entry.id, entry])),
    [chatHistory]
  )
  const visibleUpcomingCrons = useMemo(() => upcomingCrons.slice(0, 6), [upcomingCrons])
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
    onOpenAgents()
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
    <div
      className="relative flex h-full min-h-0 w-full"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={(event) => {
        void onDrop(event)
      }}
    >
      {isDragActive ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <div className="rounded-2xl border border-dashed border-primary/60 bg-card px-6 py-4 text-sm font-medium text-foreground shadow-lg">
            Drop files to attach
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-lg tracking-tight text-foreground sm:text-2xl">
            Hi, Mahith what are you working on
          </h1>
        </div>

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
          placeholder="Ask anything"
        />

        <section className="w-full max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Applications</h2>
            <span className="text-xs text-muted-foreground">{applications.length} saved</span>
          </div>

          {applications.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {applications.map((entry) => (
                <ApplicationCard
                  key={entry.chatId}
                  entry={entry}
                  chat={chatHistoryById.get(entry.chatId)}
                  onClick={() => handleLoadChat(entry.chatId)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              Applications you build in chat will appear here so you can jump back into them.
            </div>
          )}
        </section>

        <section className="w-full max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Upcoming Crons</h2>
            <span className="text-xs text-muted-foreground">{upcomingCrons.length} active</span>
          </div>

          {visibleUpcomingCrons.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleUpcomingCrons.map((cron) => (
                <UpcomingCronCard key={cron.id} cron={cron} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              No upcoming cron jobs.
            </div>
          )}
        </section>

        <section className="w-full max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Notifications</h2>
            <span className="text-xs text-muted-foreground">{notifications.length} active</span>
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
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              No active notifications.
            </div>
          )}
        </section>

        <section className="w-full max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Recent Chats</h2>
            <span className="text-xs text-muted-foreground">{chatHistory.length} stored</span>
          </div>

          {recentChats.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentChats.map((chat) => (
                <ChatHistoryCard
                  key={chat.id}
                  chat={chat}
                  onClick={() => handleLoadChat(chat.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              No previous chats yet.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Home
