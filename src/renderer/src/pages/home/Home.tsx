import type { ChatMetadata } from 'src/shared/chat'
import { useMemo, type JSX } from 'react'
import HomeHeroComposer from '../../features/chat/components/HomeHeroComposer'
import { useChatComposer } from '../../features/chat/hooks/useChatComposer'
import { useTypeToFocus } from '../../features/chat/hooks/useTypeToFocus'
import { useChatStore } from '../../features/chat/store/useChatSessionStore'
import { useHeartbeatStore } from '../../features/heartbeat/store/useHeartbeatStore'
import { useAssistantStore } from '../../store/useAssistantStore'
import { useFileDropTarget } from '../../shared/lib/fileDropTarget'
import { useSocketStore } from '../../shared/store/socketStore'
import ConnectionStatusCard from './components/ConnectionStatusCard'
import HomeHeartbeatCard from './components/HomeHeartbeatCard'
import LocalEnvironmentCard from './components/LocalEnvironmentCard'

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(timestamp)

const getRunTitle = (chat: ChatMetadata, assistantTitle?: string): string =>
  assistantTitle?.trim() || chat.title?.trim() || 'Untitled chat'

const ActiveRunCard = ({
  title,
  activeStep,
  preview,
  updatedAt,
  onClick
}: {
  title: string
  activeStep?: string | null
  preview?: string | null
  updatedAt: number
  onClick: () => void
}): JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-3xl border border-border bg-card px-4 py-4 text-left shadow-sm transition hover:bg-accent"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Active run
        </div>
        <div className="mt-2 truncate text-sm font-medium text-foreground">{title}</div>
        {activeStep ? (
          <div className="mt-1 truncate text-xs text-muted-foreground">{activeStep}</div>
        ) : null}
      </div>
      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-secondary-foreground">
        Running
      </span>
    </div>

    {preview ? (
      <div className="mt-3 line-clamp-2 text-xs text-muted-foreground">{preview}</div>
    ) : null}
    <div className="mt-3 text-xs text-muted-foreground">Updated {formatTimestamp(updatedAt)}</div>
  </button>
)

type HomeProps = {
  onOpenAgents: () => void
  onOpenAssistant: () => void
  onOpenHeartbeats: () => void
}

const Home = ({ onOpenAgents, onOpenAssistant, onOpenHeartbeats }: HomeProps): JSX.Element => {
  const chatHistory = useChatStore((state) => state.chatHistory)
  const activeHeartbeatRunId = useHeartbeatStore((state) => state.activeRunId)
  const lastHeartbeatRunId = useHeartbeatStore((state) => state.lastRunId)
  const heartbeatRunsById = useHeartbeatStore((state) => state.runsById)
  const assistantsByChatId = useAssistantStore((state) => state.assistantsByChatId)
  const connectionState = useSocketStore((state) => state.connectionState)
  const {
    attachments,
    handleKeyDown,
    isRunning,
    isUploading,
    removeAttachment,
    setValue,
    uploadError,
    uploadFiles,
    value
  } = useChatComposer({
    onSubmitted: onOpenAgents
  })
  const { handleFocusReady } = useTypeToFocus({ setValue })
  const { isDragActive, onDragEnter, onDragLeave, onDragOver, onDrop } = useFileDropTarget({
    disabled: isUploading,
    onFilesDropped: uploadFiles
  })
  const activeHeartbeat = activeHeartbeatRunId
    ? (heartbeatRunsById[activeHeartbeatRunId] ?? null)
    : null
  const lastHeartbeat = lastHeartbeatRunId ? (heartbeatRunsById[lastHeartbeatRunId] ?? null) : null
  const topHeartbeat = activeHeartbeat ?? lastHeartbeat
  const activeRuns = useMemo(
    () => [...chatHistory].filter((chat) => chat.status === 'streaming'),
    [chatHistory]
  )

  const handleLoadChat = (chatId: string): void => {
    window.api.sendSocketMessage({
      type: 'chat-history',
      data: chatId
    })
    onOpenAgents()
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

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 pb-10 pt-0 sm:px-6">
        <section className="w-full pt-0 pb-8 sm:pb-14">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
              <ConnectionStatusCard connectionState={connectionState} />

              <div className="shrink-0">
                <LocalEnvironmentCard />
              </div>

              {topHeartbeat ? (
                <div className="h-40 w-40 shrink-0">
                  <HomeHeartbeatCard
                    run={topHeartbeat}
                    title={activeHeartbeat ? 'Heartbeat running now' : 'Most recent heartbeat'}
                    onClick={onOpenHeartbeats}
                  />
                </div>
              ) : null}
            </div>

            <div className="min-w-0 w-full">
              <h1 className="sr-only">Start a conversation</h1>
              <p className="mb-2 text-sm font-medium text-muted-foreground sm:text-base">
                Hi there, Mahith
              </p>
              <HomeHeroComposer
                value={value}
                onChange={setValue}
                onKeyDown={handleKeyDown}
                onFilesSelected={uploadFiles}
                attachments={attachments}
                isUploading={isUploading}
                isRunning={isRunning}
                onRemoveAttachment={removeAttachment}
                uploadError={uploadError}
                placeholder="Ask your computer"
                autoFocus
                onFocusReady={handleFocusReady}
              />
            </div>
          </div>
        </section>

        <section className="w-full max-w-3xl">
          <button
            type="button"
            onClick={onOpenAssistant}
            className="w-full rounded-3xl border border-border bg-card px-4 py-4 text-left shadow-sm transition hover:bg-accent"
          >
            <div className="text-sm font-medium text-foreground">Make a new assistant</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Open the assistant page.
            </div>
          </button>
        </section>

        <section className="w-full max-w-3xl">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-foreground">Active runs</h2>
          </div>

          {activeRuns.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeRuns.map((chat) => (
                <ActiveRunCard
                  key={chat.id}
                  title={getRunTitle(chat, assistantsByChatId[chat.id]?.title)}
                  activeStep={chat.activeStep}
                  preview={chat.preview}
                  updatedAt={chat.updatedAt}
                  onClick={() => handleLoadChat(chat.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              No active runs right now. When an agent is running, it will appear here.
            </div>
          )}
        </section>

        {/* Home feed sections temporarily hidden: artifacts, crons, notifications, recent chats. */}
      </div>
    </div>
  )
}

export default Home
