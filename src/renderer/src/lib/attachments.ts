import type { MessageAttachment } from '@shared/chat'

type UploadAttachmentFile = {
  name: string
  type: string
  bytes: ArrayBuffer
}

export const uploadAttachments = async (
  chatId: string,
  files: File[]
): Promise<MessageAttachment[]> => {
  const payload: UploadAttachmentFile[] = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      bytes: await file.arrayBuffer()
    }))
  )

  return window.api.uploadAttachments(chatId, payload)
}
