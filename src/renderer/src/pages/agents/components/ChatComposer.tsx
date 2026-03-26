import type { ChangeEvent, JSX, KeyboardEventHandler } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { MessageAttachment } from 'src/shared/chat'
import { uploadAttachments } from '../../../lib/attachments'

type ChatComposerProps = {
  chatId: string
  value: string
  onChange: (value: string) => void
  onKeyDown: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>
  onSubmit: () => void
  attachments: MessageAttachment[]
  onAttachmentsChange: (attachments: MessageAttachment[]) => void
  fixed?: boolean
  placeholder?: string
}

const SendButton = ({
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
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
    aria-label="Send message"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  </button>
)

const AttachmentButton = ({
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
    className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
  >
    <span className="text-sm leading-none">+</span>
    <span>{disabled ? 'Uploading...' : 'Attach files'}</span>
  </button>
)

const AttachmentChip = ({
  attachment,
  onRemove
}: {
  attachment: MessageAttachment
  onRemove: (attachmentId: string) => void
}): JSX.Element => (
  <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-xs text-stone-700">
    <span className="max-w-44 truncate">
      {attachment.kind === 'image' ? 'Image' : 'File'}: {attachment.name}
    </span>
    <button
      type="button"
      onClick={() => onRemove(attachment.id)}
      className="text-stone-500 transition hover:text-stone-800"
      aria-label={`Remove ${attachment.name}`}
    >
      x
    </button>
  </div>
)

const ChatComposer = ({
  chatId,
  value,
  onChange,
  onKeyDown,
  onSubmit,
  attachments,
  onAttachmentsChange,
  fixed = true,
  placeholder = 'Message an agent...'
}: ChatComposerProps): JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

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

    setIsUploading(true)
    setUploadError(null)

    try {
      const uploadedAttachments = await uploadAttachments(chatId, selectedFiles)
      onAttachmentsChange([...attachments, ...uploadedAttachments])
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Attachment upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveAttachment = (attachmentId: string): void => {
    onAttachmentsChange(attachments.filter((attachment) => attachment.id !== attachmentId))
  }

  const wrapperClasses = fixed
    ? 'fixed inset-x-0 bottom-6 z-20 flex justify-center px-6'
    : 'mx-auto flex w-full max-w-184 justify-center'

  return (
    <div className={wrapperClasses}>
      <div className="flex w-full max-w-184 flex-col gap-3 rounded-3xl border border-stone-200 bg-white px-3.5 py-2.5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(event) => {
            void handleFilesSelected(event)
          }}
          className="hidden"
        />

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                attachment={attachment}
                onRemove={handleRemoveAttachment}
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
          rows={1}
          className="max-h-64 w-full resize-none bg-transparent text-sm leading-6 text-black outline-none placeholder:text-stone-400"
        />

        {uploadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {uploadError}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <AttachmentButton onClick={handleAttachClick} disabled={isUploading} />
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span>
              {attachments.length > 0 ? `${attachments.length} attached` : 'No files attached'}
            </span>
            <SendButton onClick={onSubmit} disabled={isUploading} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatComposer
