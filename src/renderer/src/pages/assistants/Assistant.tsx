import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import ChatMessages from '../../features/chat/components/ChatMessages'
import { useAssistantStore } from '../../store/useAssistantStore'
import AssistantHeroInput from './components/AssistantHeroInput'
import { generateAssistantTitle } from './lib/generateAssistantTitle'

type AssistantProps = {
  assistantId?: string | null
  onBack: () => void
  onCreated: (assistantId: string) => void
}

const Assistant = ({ assistantId = null, onBack, onCreated }: AssistantProps): JSX.Element => {
  const isDraft = !assistantId
  const draftAssistantId = useMemo(() => crypto.randomUUID(), [])
  const addUserMessage = useAssistantStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useAssistantStore((state) => state.createAssistantMessageStub)
  const assistantDetail = useAssistantStore(
    (state) => (assistantId ? state.assistantDetailsById[assistantId] : undefined)
  )
  const createdAssistantDetail = useAssistantStore(
    (state) => state.assistantDetailsById[draftAssistantId]
  )
  const [titleValue, setTitleValue] = useState(() => generateAssistantTitle())
  const [promptValue, setPromptValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingFocusMessageId, setPendingFocusMessageId] = useState<string | null>(null)
  const [historyBottomSpacerHeight, setHistoryBottomSpacerHeight] = useState(0)
  const historyPaneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!assistantId || assistantDetail) {
      return
    }

    window.api.sendSocketMessage({
      type: 'assistant.get',
      data: assistantId
    })
  }, [assistantDetail, assistantId])

  useEffect(() => {
    if (!isDraft || !isSubmitting || !createdAssistantDetail) {
      return
    }

    window.api.sendSocketMessage({
      type: 'assistant.submit',
      data: {
        assistantId: createdAssistantDetail.id,
        messages: createdAssistantDetail.messages
      }
    })

    setIsSubmitting(false)
    setPromptValue('')
    onCreated(createdAssistantDetail.id)
  }, [createdAssistantDetail, isDraft, isSubmitting, onCreated])

  useEffect(() => {
    const container = historyPaneRef.current
    if (!container) {
      return
    }

    const updateSpacerHeight = (): void => {
      const nextHeight = Math.max(0, Math.round(container.clientHeight / 2))
      setHistoryBottomSpacerHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight
      )
    }

    updateSpacerHeight()

    const observer = new ResizeObserver(() => {
      updateSpacerHeight()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!pendingFocusMessageId) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const container = historyPaneRef.current
      if (!container) {
        return
      }

      const target = container.querySelector<HTMLElement>(
        `[data-message-id="${pendingFocusMessageId}"]`
      )
      if (!target) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const targetMidpoint =
        targetRect.top - containerRect.top + container.scrollTop + targetRect.height / 2
      const viewportMidpoint = container.scrollTop + container.clientHeight / 2

      if (targetMidpoint > viewportMidpoint) {
        container.scrollTo({
          top: Math.max(0, targetMidpoint - container.clientHeight / 2),
          behavior: 'smooth'
        })
      }

      setPendingFocusMessageId(null)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [pendingFocusMessageId, assistantDetail?.messages])

  const handleCreateAssistant = (): void => {
    if (!isDraft || isSubmitting) {
      return
    }

    const prompt = promptValue.trim()
    if (!prompt) {
      return
    }

    setIsSubmitting(true)
    window.api.sendSocketMessage({
      type: 'assistant.create',
      data: {
        id: draftAssistantId,
        title: titleValue.trim() || generateAssistantTitle(),
        prompt
      }
    })
  }

  const activeRunId = useMemo(() => {
    if (!assistantDetail) {
      return null
    }

    const activeMessage = [...assistantDetail.messages]
      .reverse()
      .find(
        (message) =>
          message.role === 'assistant' &&
          (message.status === 'pending' || message.status === 'streaming') &&
          !!message.runId
      )

    return activeMessage?.role === 'assistant' ? (activeMessage.runId ?? null) : null
  }, [assistantDetail])

  const handleAssistantSubmit = (): void => {
    if (!assistantDetail || isSubmitting) {
      return
    }

    const prompt = promptValue.trim()
    if (!prompt) {
      return
    }

    const turnId = crypto.randomUUID()
    addUserMessage(assistantDetail.id, { content: prompt })
    createAssistantMessageStub(assistantDetail.id, turnId)

    const nextAssistantDetail = useAssistantStore.getState().assistantDetailsById[assistantDetail.id]
    if (!nextAssistantDetail) {
      return
    }

    const latestUserMessage = [...nextAssistantDetail.messages]
      .reverse()
      .find((message) => message.role === 'user')
    if (latestUserMessage?.role === 'user') {
      setPendingFocusMessageId(latestUserMessage.id)
    }

    window.api.sendSocketMessage({
      type: 'assistant.submit',
      data: {
        assistantId: assistantDetail.id,
        messages: nextAssistantDetail.messages,
        turnId
      }
    })

    setPromptValue('')
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

  return (
    <div className="relative h-full w-full overflow-hidden px-4 pt-11 sm:px-6">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="ml-[-4px] inline-flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/55 transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          {isDraft ? (
            <input
              type="text"
              value={titleValue}
              onChange={(event) => setTitleValue(event.target.value)}
              aria-label="Assistant name"
              className="min-w-0 flex-1 bg-transparent text-lg font-medium text-foreground outline-none"
            />
          ) : (
            <div className="min-w-0 flex-1 text-lg font-medium text-foreground">
              {assistantDetail?.title ?? 'Loading assistant...'}
            </div>
          )}
        </div>

        {isDraft ? (
          <div className="mt-8">
            <AssistantHeroInput
              value={promptValue}
              onChange={setPromptValue}
              onSubmit={handleCreateAssistant}
              isSubmitting={isSubmitting}
              submitDisabled={!promptValue.trim() || isSubmitting}
            />
          </div>
        ) : assistantDetail ? (
          <div className="mt-8 flex min-h-0 flex-1 flex-col gap-8">
            <AssistantHeroInput
              value={promptValue}
              onChange={setPromptValue}
              onSubmit={handleAssistantSubmit}
              onStop={handleStop}
              submitDisabled={!promptValue.trim()}
              canStop={Boolean(activeRunId)}
              submitLabel="Send"
              placeholder="Continue working with this assistant"
            />

            <div ref={historyPaneRef} className="min-h-0 flex-1 overflow-y-auto pb-6 pr-2">
              {assistantDetail.messages.length > 0 ? (
                <>
                  <ChatMessages
                    messages={assistantDetail.messages}
                    bottomSpacerClassName="h-0"
                    darkMode
                  />
                  <div aria-hidden="true" style={{ height: `${historyBottomSpacerHeight}px` }} />
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No responses yet.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            Loading assistant...
          </div>
        )}
      </div>
    </div>
  )
}

export default Assistant
