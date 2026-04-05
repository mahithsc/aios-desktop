import { ElectronAPI } from '@electron-toolkit/preload'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'

interface UploadAttachmentFile {
  name: string
  type: string
  bytes: ArrayBuffer
}

interface AppAPI {
  sendSocketMessage: (message: WSEnvelope) => void
  showWidgetWindow: () => void
  hideWidgetWindow: () => void
  toggleWidgetWindow: () => void
  getWidgetMaxHeight: () => Promise<number>
  uploadAttachments: (chatId: string, files: UploadAttachmentFile[]) => Promise<MessageAttachment[]>
  onSocketEvent: (listener: (event: WSEnvelope) => void) => () => void
  logToConsole: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    details?: unknown
  ) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
