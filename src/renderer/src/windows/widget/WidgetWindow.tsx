import type { CSSProperties, JSX, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ChatMessages from '../../components/ChatMessages'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'
import {
  WIDGET_WINDOW_KEY,
  WIDGET_WINDOW_MAX_HEIGHT_RATIO,
  WIDGET_WINDOW_MIN_HEIGHT
} from '@shared/window'

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

type WidgetWindowProps = {
  onRequestClose: () => void
}

const WidgetWindow = ({ onRequestClose }: WidgetWindowProps): JSX.Element => {
  const historyRef = useRef<HTMLDivElement | null>(null)
  const historyContentRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const chat = useChatStore((state) => state.chat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const lastAppliedHeightRef = useRef(0)
  const [historyViewportHeight, setHistoryViewportHeight] = useState<number | null>(null)

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
  const maxWindowHeight = useMemo(
    () =>
      Math.max(
        WIDGET_WINDOW_MIN_HEIGHT,
        Math.floor(window.screen.availHeight * WIDGET_WINDOW_MAX_HEIGHT_RATIO)
      ),
    []
  )
  const shouldShowHistory = chat.messages.length > 0 || isRunning

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 192)}px`
  }, [value])

  useEffect(() => {
    const history = historyRef.current
    if (!history || !shouldShowHistory) {
      return
    }

    history.scrollTo({
      top: history.scrollHeight,
      behavior: 'smooth'
    })
  }, [chat.messages, shouldShowHistory])

  useLayoutEffect(() => {
    const composer = composerRef.current
    if (!composer) {
      return
    }

    let animationFrameId = 0

    const syncLayout = (): void => {
      const composerHeight = Math.ceil(composer.getBoundingClientRect().height)
      const historyNaturalHeight =
        shouldShowHistory && historyContentRef.current
          ? Math.ceil(historyContentRef.current.getBoundingClientRect().height)
          : 0
      const nextHeight = Math.max(
        WIDGET_WINDOW_MIN_HEIGHT,
        Math.min(maxWindowHeight, composerHeight + historyNaturalHeight)
      )
      const nextHistoryViewportHeight = shouldShowHistory
        ? Math.max(0, nextHeight - composerHeight)
        : null

      setHistoryViewportHeight((current) =>
        current === nextHistoryViewportHeight ? current : nextHistoryViewportHeight
      )

      if (nextHeight === lastAppliedHeightRef.current) {
        return
      }

      lastAppliedHeightRef.current = nextHeight

      window.api.updateChildWindow({
        windowKey: WIDGET_WINDOW_KEY,
        options: {
          bounds: {
            height: nextHeight
          }
        }
      })
    }

    const scheduleSync = (): void => {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = window.requestAnimationFrame(syncLayout)
    }

    scheduleSync()

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync()
    })

    resizeObserver.observe(composer)

    if (historyContentRef.current) {
      resizeObserver.observe(historyContentRef.current)
    }

    return () => {
      resizeObserver.disconnect()
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [chat.messages, maxWindowHeight, shouldShowHistory, value])

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
    <main className="w-full text-foreground">
      <section className="flex w-full min-h-0 flex-col overflow-hidden" style={dragRegionStyle}>
        {shouldShowHistory ? (
          <div
            ref={historyRef}
            className="min-h-0 overflow-y-auto"
            style={{
              ...noDragRegionStyle,
              maxHeight: historyViewportHeight ? `${historyViewportHeight}px` : undefined
            }}
          >
            <div ref={historyContentRef} className="px-3 pt-3">
              <ChatMessages messages={chat.messages} bottomSpacerClassName="h-1" darkMode compact />
            </div>
          </div>
        ) : null}

        <div
          ref={composerRef}
          className={`p-3 ${shouldShowHistory ? 'border-t border-white/6' : ''}`}
          style={noDragRegionStyle}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Aios..."
            autoFocus
            rows={1}
            className="max-h-48 w-full resize-none rounded-[18px] bg-black px-4 py-3 text-[14px] leading-6 text-white outline-none placeholder:text-white/28"
          />

          {shouldShowHistory && (
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-white/36">
              <span>{isRunning ? 'Streaming' : 'Conversation'}</span>
              {isRunning ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-white/72 transition hover:border-white/20 hover:text-white"
                >
                  Stop
                </button>
              ) : (
                <span>Enter sends</span>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default WidgetWindow
