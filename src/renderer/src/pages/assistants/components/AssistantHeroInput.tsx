import { Paperclip } from 'lucide-react'
import { useEffect, useRef, type ChangeEvent, type JSX } from 'react'
import type { MessageAttachment } from '@shared/chat'
import PendingAttachmentCard from '../../../features/attachments/components/PendingAttachmentCard'

type AssistantHeroInputProps = {
  value: string
  onChange: (value: string) => void
  attachments: MessageAttachment[]
  onFilesAdded: (files: File[]) => void
  onRemoveAttachment: (attachmentId: string) => void
  placeholder?: string
}

const AssistantHeroInput = ({
  value,
  onChange,
  attachments,
  onFilesAdded,
  onRemoveAttachment,
  placeholder = 'What should this assistant help with?'
}: AssistantHeroInputProps): JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  const handleAttachClick = (): void => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>): void => {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (selectedFiles.length === 0) {
      return
    }

    onFilesAdded(selectedFiles)
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />

      {attachments.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <PendingAttachmentCard
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
        placeholder={placeholder}
        rows={1}
        className="min-h-[4rem] max-h-80 w-full resize-none bg-transparent text-3xl font-light leading-[1.08] tracking-tight text-foreground caret-foreground outline-none placeholder:text-muted-foreground/70 sm:text-[2.6rem]"
      />

      <div className="-mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={handleAttachClick}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          <span>Attach files</span>
        </button>
      </div>
    </div>
  )
}

export default AssistantHeroInput
