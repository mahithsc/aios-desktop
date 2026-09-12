import { ElectronAPI } from '@electron-toolkit/preload'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'
import type { DiscoveredDevice } from '../shared/discovery'
import type { AuthResult, AuthState } from '../shared/auth'
import type { CommandResult } from '../shared/device'
import type {
  AppAccessOverview,
  AppInvitation,
  AppMember,
  AppMemberUpdate,
  AppRole,
  DeployedApp
} from '../shared/appAccess'

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
  appAccess: {
    listApps: () => Promise<DeployedApp[]>
    getOverview: (appId: string) => Promise<AppAccessOverview>
    createInvitation: (
      appId: string,
      email: string,
      role: Exclude<AppRole, 'owner'>
    ) => Promise<AppInvitation>
    cancelInvitation: (appId: string, invitationId: string) => Promise<AppInvitation>
    updateMember: (appId: string, appUserId: string, update: AppMemberUpdate) => Promise<AppMember>
    removeMember: (appId: string, appUserId: string) => Promise<void>
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
