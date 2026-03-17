import { ElectronAPI } from '@electron-toolkit/preload'
import type { Chat } from '../shared/chat'

interface AppAPI {
  sendChat: (chat: Chat) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
