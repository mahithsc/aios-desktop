import type { CSSProperties, JSX, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import ChatComposer from '../../pages/agents/components/ChatComposer'
import ChatMessages from '../../components/ChatMessages'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

type WidgetWindowProps = {
  onRequestClose: () => void
}

const WidgetWindow = ({ onRequestClose }: WidgetWindowProps): JSX.Element => {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const chat = useChatStore((state) => state.chat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)

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
    const nextScrollContainer = scrollRef.current
    if (!nextScrollContainer) {
      return
    }

    nextScrollContainer.scrollTo({
      top: nextScrollContainer.scrollHeight,
      behavior: 'smooth'
    })
  }, [chat.messages])

  const handleSubmit = (): void => {
    if (isRunning) {
      return
    }

    const nextValue = value.trim()
    if (!nextValue) {
      return
    }

    const turnId = crypto.randomUUID()
    addUserMessage({ content: nextValue })
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

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onRequestClose()
      return
    }

    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.shiftKey) {
      return
    }

    event.preventDefault()
    handleSubmit()
  }

  return (
    <main className="h-screen overflow-hidden bg-transparent p-3 text-foreground">
      <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(38,38,38,0.88),rgba(20,20,20,0.78))] shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <header
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 py-3"
          style={dragRegionStyle}
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400/80" />
            <span className="text-xs font-medium uppercase tracking-[0.24em] text-white/62">
              Aios Widget
            </span>
          </div>

          <div className="flex items-center gap-2" style={noDragRegionStyle}>
            <button
              type="button"
              onClick={onRequestClose}
              className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/72 transition hover:bg-white/12 hover:text-white"
            >
              Esc
            </button>
          </div>
        </header>

        <section ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-14">
          {chat.messages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center">
              <div className="max-w-md text-center">
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">
                  Always on top
                </div>
                <h1 className="mt-3 text-3xl font-medium tracking-tight text-white">
                  Ask without leaving your screen.
                </h1>
                <p className="mt-3 text-sm leading-6 text-white/58">
                  This widget stays pinned above the desktop client so you can message the agent
                  from anywhere.
                </p>
              </div>
            </div>
          ) : (
            <ChatMessages messages={chat.messages} bottomSpacerClassName="h-4" darkMode compact />
          )}
        </section>

        <footer className="border-t border-white/8 bg-black/8 px-4 py-4">
          <ChatComposer
            value={value}
            onChange={setValue}
            onKeyDown={handleKeyDown}
            onSubmit={handleSubmit}
            onStop={handleStop}
            attachments={[]}
            isRunning={isRunning}
            canStop={!!activeRunId}
            onFilesSelected={() => Promise.resolve()}
            onRemoveAttachment={() => undefined}
            fixed={false}
            autoFocus
            showAttachmentButton={false}
            placeholder="Message Aios..."
          />
        </footer>
      </div>
    </main>
  )
}

export default WidgetWindow
