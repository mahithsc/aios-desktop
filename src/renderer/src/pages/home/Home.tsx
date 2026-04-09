import { useEffect, useMemo, type JSX } from 'react'
import HomeHeroComposer from '../../features/chat/components/HomeHeroComposer'
import { useChatComposer } from '../../features/chat/hooks/useChatComposer'
import { useChatStore } from '../../features/chat/store/useChatSessionStore'
import { useTypeToFocus } from '../../features/chat/hooks/useTypeToFocus'
import { useHeartbeatStore } from '../../features/heartbeat/store/useHeartbeatStore'
import { useFileDropTarget } from '../../shared/lib/fileDropTarget'
import { useAssistantStore } from '../../store/useAssistantStore'
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

const AssistantCard = ({
  title,
  updatedAt,
  onClick
}: {
  title: string
  updatedAt: number
  onClick: () => void
}): JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-3xl border border-border bg-card px-5 py-5 text-left shadow-sm transition hover:bg-accent"
  >
    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      Assistant
    </div>
    <div className="mt-3 truncate text-base font-medium text-foreground">{title}</div>
    <div className="mt-2 text-xs text-muted-foreground">Updated {formatTimestamp(updatedAt)}</div>
  </button>
)

const NewAssistantCard = ({ onClick }: { onClick: () => void }): JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-40 items-center justify-center rounded-3xl border border-dashed border-border bg-card px-5 py-5 text-left shadow-sm transition hover:bg-accent"
  >
    <div className="text-center">
      <div className="text-base font-medium text-foreground">Create a new assistant</div>
      <div className="mt-2 text-sm text-muted-foreground">
        Start with a mission, then save it as an assistant.
      </div>
    </div>
  </button>
)

type HomeProps = {
  onOpenAssistant: (assistantId?: string | null) => void
  onOpenAgents: () => void
  onOpenHeartbeats: () => void
}

const Home = ({ onOpenAssistant, onOpenAgents, onOpenHeartbeats }: HomeProps): JSX.Element => {
  const activeHeartbeatRunId = useHeartbeatStore((state) => state.activeRunId)
  const lastHeartbeatRunId = useHeartbeatStore((state) => state.lastRunId)
  const heartbeatRunsById = useHeartbeatStore((state) => state.runsById)
  const assistantsById = useAssistantStore((state) => state.assistantsById)
  const connectionState = useSocketStore((state) => state.connectionState)
  const newChat = useChatStore((state) => state.newChat)
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
  const assistants = useMemo(
    () =>
      Object.values(assistantsById)
        .filter((assistant): assistant is NonNullable<typeof assistant> => !!assistant)
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [assistantsById]
  )

  useEffect(() => {
    newChat()
    setValue('')
  }, [newChat, setValue])

  return (
    <div
      className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pb-10 pt-0 sm:px-6"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={(event) => {
        void onDrop(event)
      }}
    >
      {isDragActive ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-background/85 backdrop-blur-sm">
          <div className="rounded-2xl border border-dashed border-primary/60 bg-card px-6 py-4 text-sm font-medium text-foreground shadow-lg">
            Drop files to add them to this chat
          </div>
        </div>
      ) : null}

      <section className="w-full pb-2 pt-0 sm:pb-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
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
            <p className="mb-2 text-sm text-muted-foreground sm:text-base">
              Hi there, Mahith
            </p>
            <div className="mt-5 max-w-3xl">
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
                onFocusReady={handleFocusReady}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl">
        <h2 className="mb-4 text-base text-foreground">Assistants</h2>
        {assistants.length === 0 ? (
          <NewAssistantCard onClick={() => onOpenAssistant()} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assistants.map((assistant) => (
              <AssistantCard
                key={assistant.id}
                title={assistant.title}
                updatedAt={assistant.updatedAt}
                onClick={() => onOpenAssistant(assistant.id)}
              />
            ))}
            <NewAssistantCard onClick={() => onOpenAssistant()} />
          </div>
        )}
      </section>
    </div>
  )
}

export default Home
