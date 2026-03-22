import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { WSEnvelope } from '../shared/ws'

// Custom APIs for renderer
const api = {
  sendSocketMessage: (message: WSEnvelope) => ipcRenderer.send('renderer:send-socket-message', message),
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('overlay:set-ignore-mouse-events', ignore),
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
