import { ElectronAPI } from '@electron-toolkit/preload'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'
import type { DiscoveredDevice } from '../shared/discovery'
import type { AuthResult, AuthState } from '../shared/auth'
import type { PairResult, PairState } from '../shared/pairing'
import type { CommandResult } from '../shared/device'

interface UploadAttachmentFile {
  name: string
  type: string
  bytes: ArrayBuffer
}

interface AppAPI {
  sendSocketMessage: (message: WSEnvelope) => void
  uploadAttachments: (chatId: string, files: UploadAttachmentFile[]) => Promise<MessageAttachment[]>
  listDevices: () => Promise<DiscoveredDevice[]>
  auth: {
    getState: () => Promise<AuthState>
    login: (email: string, password: string) => Promise<AuthResult>
    signup: (email: string, password: string) => Promise<AuthResult>
    google: () => Promise<AuthResult>
    logout: () => Promise<void>
  }
  pairing: {
    getState: () => Promise<PairState>
    pair: (deviceId: string) => Promise<PairResult>
    unpair: () => Promise<{ ok: boolean }>
  }
  device: {
    command: (type: string, payload?: Record<string, unknown>) => Promise<CommandResult>
  }
  setIgnoreMouseEvents: (ignore: boolean) => void
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
