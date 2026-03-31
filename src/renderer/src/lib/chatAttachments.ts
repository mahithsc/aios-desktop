import { useCallback, useState } from 'react'
import type { MessageAttachment } from 'src/shared/chat'
import { uploadAttachments } from './attachments'

type UseChatAttachmentsResult = {
  attachments: MessageAttachment[]
  clearAttachments: () => void
  isUploading: boolean
  removeAttachment: (attachmentId: string) => void
  uploadError: string | null
  uploadFiles: (files: File[]) => Promise<void>
}

const getUploadErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Attachment upload failed.'

export const useChatAttachments = (chatId: string): UseChatAttachmentsResult => {
  const [attachmentsByChatId, setAttachmentsByChatId] = useState<Record<string, MessageAttachment[]>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const attachments = attachmentsByChatId[chatId] ?? []

  const clearAttachments = useCallback(() => {
    setUploadError(null)
    setAttachmentsByChatId((current) => ({ ...current, [chatId]: [] }))
  }, [chatId])

  const removeAttachment = useCallback(
    (attachmentId: string) => {
      setAttachmentsByChatId((current) => ({
        ...current,
        [chatId]: (current[chatId] ?? []).filter((attachment) => attachment.id !== attachmentId)
      }))
    },
    [chatId]
  )

  const uploadFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (isUploading || files.length === 0) {
        return
      }

      setIsUploading(true)
      setUploadError(null)

      try {
        const uploadedAttachments = await uploadAttachments(chatId, files)
        setAttachmentsByChatId((current) => ({
          ...current,
          [chatId]: [...(current[chatId] ?? []), ...uploadedAttachments]
        }))
      } catch (error) {
        setUploadError(getUploadErrorMessage(error))
      } finally {
        setIsUploading(false)
      }
    },
    [chatId, isUploading]
  )

  return {
    attachments,
    clearAttachments,
    isUploading,
    removeAttachment,
    uploadError,
    uploadFiles
  }
}
