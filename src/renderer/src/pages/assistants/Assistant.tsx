import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState, type JSX } from 'react'
import type { MessageAttachment } from '@shared/chat'
import { useFileDropTarget } from '../../shared/lib/fileDropTarget'
import AssistantHeroInput from './components/AssistantHeroInput'

type AssistantProps = {
  onBack: () => void
}

const toAttachmentKind = (file: File): MessageAttachment['kind'] => {
  if (file.type.startsWith('image/')) {
    return 'image'
  }

  if (file.type.startsWith('audio/')) {
    return 'audio'
  }

  return 'file'
}

const createPendingAttachment = (file: File): MessageAttachment => {
  const kind = toAttachmentKind(file)

  return {
    id: crypto.randomUUID(),
    kind,
    name: file.name,
    filePath: file.name,
    previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
    mimeType: file.type || undefined,
    sizeBytes: file.size
  }
}

const Assistant = ({ onBack }: AssistantProps): JSX.Element => {
  const [promptValue, setPromptValue] = useState('')
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const attachmentsRef = useRef<MessageAttachment[]>([])

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(
    () => () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      }
    },
    []
  )

  const addAttachments = (files: File[]): void => {
    if (files.length === 0) {
      return
    }

    setAttachments((existing) => [...existing, ...files.map(createPendingAttachment)])
  }

  const removeAttachment = (attachmentId: string): void => {
    setAttachments((existing) => {
      const attachment = existing.find((item) => item.id === attachmentId)
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl)
      }

      return existing.filter((item) => item.id !== attachmentId)
    })
  }

  const { isDragActive, onDragEnter, onDragLeave, onDragOver, onDrop } = useFileDropTarget({
    onFilesDropped: addAttachments
  })

  return (
    <div
      className="relative h-full w-full overflow-y-auto px-4 pt-11 sm:px-6"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={(event) => {
        void onDrop(event)
      }}
    >
      {isDragActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <div className="rounded-2xl border border-dashed border-primary/60 bg-card px-6 py-4 text-sm font-medium text-foreground shadow-lg">
            Drop files to attach
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="ml-[-4px] inline-flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/55 transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <input
          type="text"
          defaultValue="Untitled"
          aria-label="Assistant name"
          className="min-w-0 flex-1 bg-transparent text-lg font-medium text-foreground outline-none"
        />
      </div>

      <div className="mt-8">
        <AssistantHeroInput
          value={promptValue}
          onChange={setPromptValue}
          attachments={attachments}
          onFilesAdded={addAttachments}
          onRemoveAttachment={removeAttachment}
        />
      </div>
    </div>
  )
}

export default Assistant
