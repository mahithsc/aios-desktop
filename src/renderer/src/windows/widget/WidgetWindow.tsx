import type {
  ChangeEvent,
  CSSProperties,
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode
} from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MessageAttachment } from 'src/shared/chat'
import ChatMessages from '../../components/ChatMessages'
import { useChatAttachments } from '../../lib/chatAttachments'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

type WidgetWindowProps = {
  onRequestClose: () => void
}

const ComposerActionButton = ({
  label,
  ariaLabel,
  onClick,
  disabled = false,
  variant = 'secondary',
  iconOnly = false,
  className = ''
}: {
  label: ReactNode
  ariaLabel?: string
  onClick: () => void
  disabled?: boolean
  variant?: 'secondary' | 'primary' | 'warning'
  iconOnly?: boolean
  className?: string
}): JSX.Element => {
  const variantClassName =
    variant === 'primary'
      ? 'bg-white text-black hover:bg-white/85'
      : variant === 'warning'
        ? 'bg-amber-500 text-black hover:bg-amber-400'
        : 'bg-white/6 text-white/72 hover:bg-white/10 hover:text-white'
  const sizeClassName = iconOnly
    ? 'h-8 w-8 rounded-full px-0'
    : 'h-8 rounded-full px-3 text-[11px]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center leading-none font-medium transition disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/28 ${sizeClassName} ${variantClassName} ${className}`}
    >
      {label}
    </button>
  )
}

const AttachmentChip = ({
  attachment,
  onRemove
}: {
  attachment: MessageAttachment
  onRemove: (attachmentId: string) => void
}): JSX.Element => (
  <div className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-[11px] text-white/72">
    <span className="max-w-40 truncate">
      {attachment.kind === 'image' ? 'Image' : attachment.kind === 'audio' ? 'Audio' : 'File'}:{' '}
      {attachment.name}
    </span>
    <button
      type="button"
      onClick={() => onRemove(attachment.id)}
      className="text-white/40 transition hover:text-white/80"
      aria-label={`Remove ${attachment.name}`}
    >
      x
    </button>
  </div>
)

const WidgetWindow = ({ onRequestClose }: WidgetWindowProps): JSX.Element => {
  const widgetRef = useRef<HTMLElement | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const chat = useChatStore((state) => state.chat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const newChat = useChatStore((state) => state.newChat)
  const { attachments, clearAttachments, isUploading, removeAttachment, uploadError, uploadFiles } =
    useChatAttachments(chat.id)
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
      const nextMaxWindowHeight = await window.api.getWidgetMaxHeight()
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
    if (isRunning || isUploading) {
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
    clearAttachments()
    newChat()
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

  const handleAttachClick = (): void => {
    if (isUploading) {
      return
    }

    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (selectedFiles.length === 0) {
      return
    }

    await uploadFiles(selectedFiles)
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
        className={`relative flex w-full flex-col overflow-hidden rounded-[18px] bg-[rgb(24,24,24)]/82 ${isHeightCapped ? 'h-full min-h-0' : ''}`}
        style={dragRegionStyle}
      >
        {shouldShowHistory ? (
          <div
            ref={historyRef}
            className={isHeightCapped ? 'min-h-0 flex-1 overflow-y-auto' : 'overflow-y-visible'}
            style={noDragRegionStyle}
          >
            <div className="px-3 pt-2">
              <ChatMessages messages={chat.messages} bottomSpacerClassName="h-1" darkMode compact />
            </div>
          </div>
        ) : null}

        <div
          className={shouldShowHistory ? 'border-t border-white/6' : undefined}
          style={noDragRegionStyle}
        >
          <div className="rounded-[18px] bg-black">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(event) => {
                void handleFilesSelected(event)
              }}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Aios..."
              autoFocus
              rows={1}
              className="block max-h-48 w-full resize-none bg-transparent px-4 pt-3 text-[14px] leading-6 text-white outline-none placeholder:text-white/28"
            />

            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2 px-4 pt-2">
                {attachments.map((attachment) => (
                  <AttachmentChip
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={removeAttachment}
                  />
                ))}
              </div>
            ) : null}

            {uploadError ? (
              <div className="px-4 pt-2">
                <div className="rounded-2xl border border-red-500/25 bg-red-500/12 px-3 py-2 text-[11px] text-red-200">
                  {uploadError}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2">
              <ComposerActionButton
                label={
                  isUploading ? (
                    'Uploading...'
                  ) : (
                    <span className="inline-flex items-center gap-1.5 leading-none">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                        aria-hidden="true"
                      >
                        <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      <span className="leading-none">Attach files</span>
                    </span>
                  )
                }
                onClick={handleAttachClick}
                disabled={isUploading}
                className="!h-auto !rounded-none !bg-transparent px-0 hover:!bg-transparent disabled:!bg-transparent"
              />

              <div className="flex items-center gap-2">
                {chat.messages.length > 0 ? (
                  <ComposerActionButton
                    label={
                      <span className="inline-flex items-center gap-1 leading-none">
                        <span className="text-[15px] leading-none">+</span>
                        <span className="leading-none">New Chat</span>
                      </span>
                    }
                    onClick={handleNewMessage}
                    className="!h-auto !rounded-none !bg-transparent px-0 hover:!bg-transparent disabled:!bg-transparent"
                  />
                ) : null}
                {isRunning ? (
                  <ComposerActionButton
                    label={
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                        <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
                      </svg>
                    }
                    ariaLabel="Stop run"
                    onClick={handleStop}
                    disabled={!activeRunId}
                    variant="warning"
                    iconOnly
                  />
                ) : (
                  <ComposerActionButton
                    label={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path d="M12 19V5" />
                        <path d="m6 11 6-6 6 6" />
                      </svg>
                    }
                    ariaLabel="Send message"
                    onClick={handleSubmit}
                    disabled={isUploading || (!value.trim() && attachments.length === 0)}
                    variant="primary"
                    iconOnly
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default WidgetWindow
