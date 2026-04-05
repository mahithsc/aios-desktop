import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'
import type { ChildWindowRegistration, ChildWindowUpdate } from '../shared/window'

type UploadAttachmentFile = {
  name: string
  type: string
  bytes: ArrayBuffer
}

// Custom APIs for renderer
const api = {
  sendSocketMessage: (message: WSEnvelope) =>
    ipcRenderer.send('renderer:send-socket-message', message),
  registerChildWindow: (registration: ChildWindowRegistration): Promise<void> =>
    ipcRenderer.invoke('renderer:register-child-window', registration),
  updateChildWindow: (update: ChildWindowUpdate) =>
    ipcRenderer.send('renderer:update-child-window', update),
  showChildWindow: (windowKey: string) => ipcRenderer.send('renderer:show-child-window', windowKey),
  hideChildWindow: (windowKey: string) => ipcRenderer.send('renderer:hide-child-window', windowKey),
  getChildWindowMaxHeight: (windowKey: string): Promise<number> =>
    ipcRenderer.invoke('renderer:get-child-window-max-height', windowKey),
  uploadAttachments: (
    chatId: string,
    files: UploadAttachmentFile[]
  ): Promise<MessageAttachment[]> =>
    ipcRenderer.invoke('renderer:upload-attachments', { chatId, files }),
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
  },
  onToggleWidgetWindowRequested: (listener: () => void) => {
    const subscription = (): void => {
      listener()
    }

    ipcRenderer.on('main:toggle-widget-window-requested', subscription)

    return () => {
      ipcRenderer.removeListener('main:toggle-widget-window-requested', subscription)
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
