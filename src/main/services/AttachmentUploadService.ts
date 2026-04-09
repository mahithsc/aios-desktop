import type { MessageAttachment } from '../../shared/chat'
import { SERVER_URL } from '../../shared/config'

export type UploadAttachmentFile = {
  name: string
  type: string
  bytes: ArrayBuffer | Uint8Array
}

const getUploadErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail
    }
  } catch {
    // Ignore JSON parsing errors and fall back to the response status text.
  }

  return response.statusText || 'Attachment upload failed.'
}

const toBlobBytes = (bytes: UploadAttachmentFile['bytes']): ArrayBuffer => {
  const nextBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const arrayBuffer = new ArrayBuffer(nextBytes.byteLength)
  new Uint8Array(arrayBuffer).set(nextBytes)
  return arrayBuffer
}

export const uploadAttachments = async (
  chatId: string,
  files: UploadAttachmentFile[]
): Promise<MessageAttachment[]> => {
  const formData = new FormData()
  formData.append('chatId', chatId)

  for (const file of files) {
    const blob = new Blob([toBlobBytes(file.bytes)], {
      type: file.type || 'application/octet-stream'
    })
    formData.append('files', blob, file.name)
  }

  const response = await fetch(`${SERVER_URL}/attachments`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(await getUploadErrorMessage(response))
  }

  const responsePayload = (await response.json()) as { attachments?: MessageAttachment[] }
  return Array.isArray(responsePayload.attachments) ? responsePayload.attachments : []
}
