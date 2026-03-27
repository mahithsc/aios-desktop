import type { MessageAttachment } from '@shared/chat'
import { SERVER_URL } from '@shared/config'

type UploadAttachmentsResponse = {
  attachments?: MessageAttachment[]
  detail?: string
}

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as UploadAttachmentsResponse
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail
    }
  } catch {
    // Ignore JSON parsing errors and fall back to the response status text.
  }

  return response.statusText || 'Attachment upload failed.'
}

export const uploadAttachments = async (
  chatId: string,
  files: File[]
): Promise<MessageAttachment[]> => {
  const formData = new FormData()
  formData.append('chatId', chatId)

  for (const file of files) {
    formData.append('files', file, file.name)
  }

  const response = await fetch(`${SERVER_URL}/attachments`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  const payload = (await response.json()) as UploadAttachmentsResponse
  return Array.isArray(payload.attachments) ? payload.attachments : []
}
