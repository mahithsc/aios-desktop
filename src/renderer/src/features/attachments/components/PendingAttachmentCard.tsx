import { File, FileText, Music4, X } from 'lucide-react'
import { useState, type JSX } from 'react'
import type { MessageAttachment } from '@shared/chat'

type PendingAttachmentCardProps = {
  attachment: MessageAttachment
  onRemove?: (attachmentId: string) => void
}

const getFileExtension = (attachment: MessageAttachment): string | null => {
  const segments = attachment.name.split('.')
  const extension = segments.length > 1 ? segments.at(-1)?.trim() : null

  if (!extension) {
    return null
  }

  return extension.slice(0, 8).toUpperCase()
}

const isPdfAttachment = (attachment: MessageAttachment): boolean =>
  attachment.mimeType === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf')

const isMarkdownAttachment = (attachment: MessageAttachment): boolean =>
  attachment.mimeType === 'text/markdown' ||
  attachment.mimeType === 'text/md' ||
  attachment.name.toLowerCase().endsWith('.md')

const getAttachmentTypeLabel = (attachment: MessageAttachment): string => {
  const extension = getFileExtension(attachment)
  if (extension) {
    return extension
  }

  if (attachment.kind === 'image') {
    return 'IMAGE'
  }

  if (attachment.kind === 'audio') {
    return 'AUDIO'
  }

  return 'FILE'
}

const getFallbackTileClassName = (attachment: MessageAttachment): string => {
  if (isMarkdownAttachment(attachment)) {
    return 'bg-sky-300 text-sky-950'
  }

  if (attachment.kind === 'audio') {
    return 'bg-sky-500/85 text-white'
  }

  if (isPdfAttachment(attachment)) {
    return 'bg-red-500 text-white'
  }

  return 'bg-secondary text-secondary-foreground'
}

const AttachmentVisual = ({
  attachment,
  sizeClassName = 'h-9 w-9'
}: {
  attachment: MessageAttachment
  sizeClassName?: string
}): JSX.Element => {
  const [hasImageError, setHasImageError] = useState(false)
  const imagePreviewUrl = attachment.kind === 'image' ? attachment.previewUrl : undefined

  if (imagePreviewUrl && !hasImageError) {
    return (
      <div className={`${sizeClassName} shrink-0 overflow-hidden rounded-lg bg-secondary`}>
        <img
          src={imagePreviewUrl}
          alt={attachment.name}
          className="h-full w-full object-cover"
          onError={() => setHasImageError(true)}
        />
      </div>
    )
  }

  const Icon = attachment.kind === 'audio' ? Music4 : isPdfAttachment(attachment) ? FileText : File

  return (
    <div
      className={`flex ${sizeClassName} shrink-0 items-center justify-center rounded-lg ${getFallbackTileClassName(
        attachment
      )}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </div>
  )
}

const PendingAttachmentCard = ({
  attachment,
  onRemove
}: PendingAttachmentCardProps): JSX.Element => {
  if (attachment.kind === 'image') {
    return (
      <div className="group relative inline-flex h-[3.25rem] w-[3.25rem] rounded-[1.1rem] border border-border/90 bg-card/95 p-1 shadow-sm">
        <AttachmentVisual attachment={attachment} sizeClassName="h-full w-full" />
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition hover:bg-accent"
            aria-label={`Remove ${attachment.name}`}
          >
            <X className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="group relative inline-flex min-w-0 max-w-[12.5rem] items-center gap-2 rounded-[1.1rem] border border-border/90 bg-card/95 px-2 py-1.5 shadow-sm">
      <AttachmentVisual attachment={attachment} />

      <div className={`min-w-0 flex-1 ${onRemove ? 'pr-5' : ''}`}>
        <div className="truncate text-[12px] font-medium tracking-tight text-foreground">
          {attachment.name}
        </div>
        <div className="mt-0.5 text-[10px] leading-none text-muted-foreground">
          {getAttachmentTypeLabel(attachment)}
        </div>
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(attachment.id)}
          className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition hover:bg-accent"
          aria-label={`Remove ${attachment.name}`}
        >
          <X className="h-2.5 w-2.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export default PendingAttachmentCard
