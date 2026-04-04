import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'

type UploadAttachmentFile = {
  name: string
  type: string
  bytes: ArrayBuffer
}

// Custom APIs for renderer
const api = {
  sendSocketMessage: (message: WSEnvelope) =>
    ipcRenderer.send('renderer:send-socket-message', message),
  toggleWidgetWindow: () => ipcRenderer.send('renderer:toggle-widget-window'),
  hideWidgetWindow: () => ipcRenderer.send('renderer:hide-widget-window'),
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
  onWidgetVisibilityChanged: (listener: (visible: boolean) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, visible: boolean): void => {
      listener(visible)
    }

    ipcRenderer.on('main:widget-visibility-changed', subscription)

    return () => {
      ipcRenderer.removeListener('main:widget-visibility-changed', subscription)
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
