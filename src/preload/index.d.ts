import { ElectronAPI } from '@electron-toolkit/preload'
import type { Chat } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'

interface AppAPI {
  sendChat: (chat: Chat) => void
  setIgnoreMouseEvents: (ignore: boolean) => void
  onSocketEvent: (listener: (event: WSEnvelope) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
