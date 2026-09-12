import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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

type UploadAttachmentFile = {
  name: string
  type: string
  bytes: ArrayBuffer
}

// Custom APIs for renderer
const api = {
  sendSocketMessage: (message: WSEnvelope) =>
    ipcRenderer.send('renderer:send-socket-message', message),
  uploadAttachments: (
    chatId: string,
    files: UploadAttachmentFile[]
  ): Promise<MessageAttachment[]> =>
    ipcRenderer.invoke('renderer:upload-attachments', { chatId, files }),
  listDevices: (): Promise<DiscoveredDevice[]> => ipcRenderer.invoke('discovery:list'),
  auth: {
    getState: (): Promise<AuthState> => ipcRenderer.invoke('auth:get-state'),
    login: (email: string, password: string): Promise<AuthResult> =>
      ipcRenderer.invoke('auth:login', { email, password }),
    signup: (email: string, password: string): Promise<AuthResult> =>
      ipcRenderer.invoke('auth:signup', { email, password }),
    google: (): Promise<AuthResult> => ipcRenderer.invoke('auth:google'),
    logout: (): Promise<void> => ipcRenderer.invoke('auth:logout')
  },
  appAccess: {
    listApps: (): Promise<DeployedApp[]> => ipcRenderer.invoke('app-access:list'),
    getOverview: (appId: string): Promise<AppAccessOverview> =>
      ipcRenderer.invoke('app-access:overview', appId),
    createInvitation: (
      appId: string,
      email: string,
      role: Exclude<AppRole, 'owner'>
    ): Promise<AppInvitation> =>
      ipcRenderer.invoke('app-access:create-invitation', { appId, email, role }),
    cancelInvitation: (appId: string, invitationId: string): Promise<AppInvitation> =>
      ipcRenderer.invoke('app-access:cancel-invitation', { appId, invitationId }),
    updateMember: (appId: string, appUserId: string, update: AppMemberUpdate): Promise<AppMember> =>
      ipcRenderer.invoke('app-access:update-member', { appId, appUserId, update }),
    removeMember: (appId: string, appUserId: string): Promise<void> =>
      ipcRenderer.invoke('app-access:remove-member', { appId, appUserId })
  },
  device: {
    command: (type: string, payload?: Record<string, unknown>): Promise<CommandResult> =>
      ipcRenderer.invoke('device:command', { type, payload })
  },
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send('overlay:set-ignore-mouse-events', ignore),
  logToConsole: (level: 'debug' | 'info' | 'warn' | 'error', message: string, details?: unknown) =>
    ipcRenderer.send('renderer:log', { level, message, details }),
  onSocketEvent: (listener: (event: WSEnvelope) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, socketEvent: WSEnvelope): void => {
      listener(socketEvent)
    }

    ipcRenderer.on('main:socket-event', subscription)

    return () => {
      ipcRenderer.removeListener('main:socket-event', subscription)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
