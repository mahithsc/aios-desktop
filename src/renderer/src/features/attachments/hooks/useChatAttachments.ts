import { useCallback, useEffect, useRef, useState } from 'react'
import type { MessageAttachment } from 'src/shared/chat'
import { uploadAttachments } from '../lib/attachments'

type UseChatAttachmentsResult = {
  attachments: MessageAttachment[]
  clearAttachments: (options?: { revokePreviewUrls?: boolean }) => void
  isUploading: boolean
  removeAttachment: (attachmentId: string) => void
  uploadError: string | null
  uploadFiles: (files: File[]) => Promise<void>
}

const getUploadErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Attachment upload failed.'

const revokePreviewUrls = (attachments: MessageAttachment[]): void => {
  for (const attachment of attachments) {
    if (attachment.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.previewUrl)
    }
  }
}

export const useChatAttachments = (chatId: string): UseChatAttachmentsResult => {
  const [attachmentsByChatId, setAttachmentsByChatId] = useState<
    Record<string, MessageAttachment[]>
  >({})
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const attachmentsByChatIdRef = useRef<Record<string, MessageAttachment[]>>({})

  const attachments = attachmentsByChatId[chatId] ?? []

  useEffect(() => {
    attachmentsByChatIdRef.current = attachmentsByChatId
  }, [attachmentsByChatId])

  useEffect(() => {
    return () => {
      for (const scopedAttachments of Object.values(attachmentsByChatIdRef.current)) {
        revokePreviewUrls(scopedAttachments)
      }
    }
  }, [])

  const clearAttachments = useCallback((options?: { revokePreviewUrls?: boolean }) => {
    setUploadError(null)
    if (options?.revokePreviewUrls !== false) {
      revokePreviewUrls(attachments)
    }
    setAttachmentsByChatId((current) => ({ ...current, [chatId]: [] }))
  }, [attachments, chatId])

  const removeAttachment = useCallback(
    (attachmentId: string) => {
      const attachmentToRemove = attachments.find((attachment) => attachment.id === attachmentId)
      if (attachmentToRemove) {
        revokePreviewUrls([attachmentToRemove])
      }

      setAttachmentsByChatId((current) => ({
        ...current,
        [chatId]: (current[chatId] ?? []).filter((attachment) => attachment.id !== attachmentId)
      }))
    },
    [attachments, chatId]
  )

  const uploadFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (isUploading || files.length === 0) {
        return
      }

      setIsUploading(true)
      setUploadError(null)
      const previewUrls = files.map((file) =>
        file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      )

      try {
        const uploadedAttachments = await uploadAttachments(chatId, files)
        setAttachmentsByChatId((current) => ({
          ...current,
          [chatId]: [
            ...(current[chatId] ?? []),
            ...uploadedAttachments.map((attachment, index) => ({
              ...attachment,
              previewUrl: previewUrls[index] ?? undefined
            }))
          ]
        }))
      } catch (error) {
        for (const previewUrl of previewUrls) {
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
          }
        }
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
