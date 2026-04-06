import { useEffect, useRef, type JSX, type KeyboardEventHandler } from 'react'
import type { MessageAttachment } from 'src/shared/chat'

type HomeHeroComposerProps = {
  value: string
  onChange: (value: string) => void
  onKeyDown: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>
  onStop?: () => void
  attachments: MessageAttachment[]
  isUploading?: boolean
  isRunning?: boolean
  canStop?: boolean
  onRemoveAttachment: (attachmentId: string) => void
  uploadError?: string | null
  placeholder?: string
  autoFocus?: boolean
  onFocusReady?: (focus: () => void) => void
}

const StopButton = ({
  onClick,
  disabled
}: {
  onClick: () => void
  disabled?: boolean
}): JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
    aria-label="Stop run"
  >
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
    </svg>
  </button>
)

const AttachmentChip = ({
  attachment,
  onRemove
}: {
  attachment: MessageAttachment
  onRemove: (attachmentId: string) => void
}): JSX.Element => (
  <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground">
    <span className="max-w-44 truncate">
      {attachment.kind === 'image' ? 'Image' : attachment.kind === 'audio' ? 'Audio' : 'File'}:{' '}
      {attachment.name}
    </span>
    <button
      type="button"
      onClick={() => onRemove(attachment.id)}
      className="text-muted-foreground transition hover:text-foreground"
      aria-label={`Remove ${attachment.name}`}
    >
      x
    </button>
  </div>
)

const HomeHeroComposer = ({
  value,
  onChange,
  onKeyDown,
  onStop,
  attachments,
  isUploading = false,
  isRunning = false,
  canStop = false,
  onRemoveAttachment,
  uploadError = null,
  placeholder = 'Ask your computer',
  autoFocus = false,
  onFocusReady
}: HomeHeroComposerProps): JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  useEffect(() => {
    onFocusReady?.(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      const cursorPosition = textarea.value.length
      textarea.setSelectionRange(cursorPosition, cursorPosition)
    })
  }, [onFocusReady])

  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-4 bg-transparent px-0 py-0">
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                attachment={attachment}
                onRemove={onRemoveAttachment}
              />
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={1}
          className="min-h-[4rem] max-h-80 w-full resize-none bg-transparent text-3xl font-light leading-[1.08] tracking-tight text-foreground caret-foreground outline-none placeholder:text-muted-foreground/70 sm:text-[2.6rem]"
        />

        {uploadError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs text-red-200">
            {uploadError}
          </div>
        ) : null}

        {isRunning || isUploading || attachments.length > 0 ? (
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {isRunning
                ? canStop
                  ? 'Agent is running'
                  : 'Starting run...'
                : isUploading
                  ? 'Uploading files...'
                  : `${attachments.length} attached`}
            </span>
            {isRunning ? <StopButton onClick={() => onStop?.()} disabled={!canStop} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default HomeHeroComposer
