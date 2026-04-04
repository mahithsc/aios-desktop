import { ElectronAPI } from '@electron-toolkit/preload'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'
import type { ChildWindowRegistration, ChildWindowUpdate } from '../shared/window'

interface UploadAttachmentFile {
  name: string
  type: string
  bytes: ArrayBuffer
}

interface AppAPI {
  sendSocketMessage: (message: WSEnvelope) => void
  registerChildWindow: (registration: ChildWindowRegistration) => Promise<void>
  updateChildWindow: (update: ChildWindowUpdate) => void
  showChildWindow: (windowKey: string) => void
  uploadAttachments: (chatId: string, files: UploadAttachmentFile[]) => Promise<MessageAttachment[]>
  onSocketEvent: (listener: (event: WSEnvelope) => void) => () => void
  onToggleWidgetWindowRequested: (listener: () => void) => () => void
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
