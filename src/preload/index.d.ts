import { ElectronAPI } from '@electron-toolkit/preload'
import type { WSEnvelope } from '../shared/ws'

interface AppAPI {
  sendSocketMessage: (message: WSEnvelope) => void
  setIgnoreMouseEvents: (ignore: boolean) => void
  onSocketEvent: (listener: (event: WSEnvelope) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
