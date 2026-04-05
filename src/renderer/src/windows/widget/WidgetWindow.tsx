import type { CSSProperties, JSX, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ChatMessages from '../../components/ChatMessages'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'
import { WIDGET_WINDOW_KEY } from '@shared/window'

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

type WidgetWindowProps = {
  onRequestClose: () => void
}

const WidgetWindow = ({ onRequestClose }: WidgetWindowProps): JSX.Element => {
  const widgetRef = useRef<HTMLElement | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const chat = useChatStore((state) => state.chat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const newChat = useChatStore((state) => state.newChat)
  const [maxWindowHeight, setMaxWindowHeight] = useState<number | null>(null)
  const [isHeightCapped, setIsHeightCapped] = useState(false)

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
    let isCancelled = false

    const syncMaxWindowHeight = async (): Promise<void> => {
      const nextMaxWindowHeight = await window.api.getChildWindowMaxHeight(WIDGET_WINDOW_KEY)
      if (isCancelled) {
        return
      }

      setMaxWindowHeight((current) =>
        current === nextMaxWindowHeight ? current : nextMaxWindowHeight
      )
    }

    void syncMaxWindowHeight()

    const handleResize = (): void => {
      void syncMaxWindowHeight()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      isCancelled = true
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const history = historyRef.current
    if (!history || !shouldShowHistory || isRunning) {
      return
    }

    history.scrollTo({
      top: history.scrollHeight,
      behavior: 'smooth'
    })
  }, [chat.messages, isRunning, shouldShowHistory])

  useLayoutEffect(() => {
    const widget = widgetRef.current
    const history = historyRef.current

    if (!widget || !history || maxWindowHeight === null) {
      setIsHeightCapped(false)
      return
    }

    let animationFrameId = 0

    const syncCappedState = (): void => {
      const nextIsHeightCapped = shouldShowHistory && window.outerHeight >= maxWindowHeight - 1

      setIsHeightCapped((current) => (current === nextIsHeightCapped ? current : nextIsHeightCapped))
    }

    const scheduleSync = (): void => {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = window.requestAnimationFrame(syncCappedState)
    }

    scheduleSync()

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync()
    })

    resizeObserver.observe(widget)
    resizeObserver.observe(history)

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

  const handleNewMessage = (): void => {
    if (activeRunId) {
      window.api.sendSocketMessage({
        type: 'run.stop',
        data: {
          runId: activeRunId
        }
      })
    }

    clearValue()
    newChat()
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
    <main className={`mx-auto w-[90%] text-foreground ${isHeightCapped ? 'h-screen' : ''}`}>
      <section
        ref={widgetRef}
        className={`relative flex w-full flex-col overflow-hidden rounded-[18px] bg-[rgb(30,30,30)]/70 ${isHeightCapped ? 'h-full min-h-0' : ''}`}
        style={dragRegionStyle}
      >
        {shouldShowHistory ? (
          <div
            ref={historyRef}
            className={isHeightCapped ? 'min-h-0 flex-1 overflow-y-auto' : 'overflow-y-visible'}
            style={noDragRegionStyle}
          >
            <div>
              <div
                className="sticky top-0 z-10 bg-[rgb(30,30,30)]/70 px-3 pb-2 pt-3"
                style={noDragRegionStyle}
              >
                <button
                  type="button"
                  onClick={handleNewMessage}
                  className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  + New message
                </button>
              </div>
              <div className="px-3">
                <ChatMessages messages={chat.messages} bottomSpacerClassName="h-1" darkMode compact />
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={shouldShowHistory ? 'border-t border-white/6' : undefined}
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
        </div>
      </section>
    </main>
  )
}

export default WidgetWindow
