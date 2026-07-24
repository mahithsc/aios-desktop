import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { MessageAttachment } from '../shared/chat'
import {
  TRANSCRIPTION_HIDE_WINDOW_CHANNEL,
  TRANSCRIPTION_RECORDING_COMPLETE_CHANNEL,
  TRANSCRIPTION_RECORDING_ERROR_CHANNEL,
  TRANSCRIPTION_START_RECORDING_CHANNEL,
  TRANSCRIPTION_STOP_RECORDING_CHANNEL,
  type TranscriptionRecordingErrorPayload,
  type TranscriptionRecordingPayload,
  type TranscriptionRecordingSavedPayload
} from '../shared/transcription'
import type { SocketConnectionState } from '../main/services/SocketService'
import type { WSEnvelope } from '../shared/ws'

type UploadAttachmentFile = {
  name: string
  type: string
  bytes: ArrayBuffer
}

type WidgetPosition = {
  x: number
  y: number
}

// Custom APIs for renderer
const api = {
  sendSocketMessage: (message: WSEnvelope) =>
    ipcRenderer.send('renderer:send-socket-message', message),
  showWidgetWindow: () => ipcRenderer.send('renderer:show-widget-window'),
  hideWidgetWindow: () => ipcRenderer.send('renderer:hide-widget-window'),
  toggleWidgetWindow: () => ipcRenderer.send('renderer:toggle-widget-window'),
  moveWidgetWindow: (position: WidgetPosition) =>
    ipcRenderer.send('renderer:move-widget-window', position),
  resizeWidgetWindowToHeight: (height: number) =>
    ipcRenderer.send('renderer:resize-widget-window-height', height),
  resetWidgetWindowHeight: () => ipcRenderer.send('renderer:reset-widget-window-height'),
  getWidgetMaxHeight: (): Promise<number> => ipcRenderer.invoke('renderer:get-widget-max-height'),
  uploadAttachments: (
    chatId: string,
    files: UploadAttachmentFile[]
  ): Promise<MessageAttachment[]> =>
    ipcRenderer.invoke('renderer:upload-attachments', { chatId, files }),
  captureWidgetScreenshotAttachment: (chatId: string): Promise<MessageAttachment> =>
    ipcRenderer.invoke('renderer:capture-widget-screenshot-attachment', { chatId }),
  completeTranscriptionRecording: (
    payload: TranscriptionRecordingPayload
  ): Promise<TranscriptionRecordingSavedPayload> =>
    ipcRenderer.invoke(TRANSCRIPTION_RECORDING_COMPLETE_CHANNEL, payload),
  hideTranscriptionWindow: () => ipcRenderer.send(TRANSCRIPTION_HIDE_WINDOW_CHANNEL),
  reportTranscriptionRecordingError: (payload: TranscriptionRecordingErrorPayload) =>
    ipcRenderer.send(TRANSCRIPTION_RECORDING_ERROR_CHANNEL, payload),
  logToConsole: (level: 'debug' | 'info' | 'warn' | 'error', message: string, details?: unknown) =>
    ipcRenderer.send('renderer:log', { level, message, details }),
  onTranscriptionStartRecording: (listener: () => void) => {
    const subscription = (): void => {
      listener()
    }

    ipcRenderer.on(TRANSCRIPTION_START_RECORDING_CHANNEL, subscription)

    return () => {
      ipcRenderer.removeListener(TRANSCRIPTION_START_RECORDING_CHANNEL, subscription)
    }
  },
  onTranscriptionStopRecording: (listener: () => void) => {
    const subscription = (): void => {
      listener()
    }

    ipcRenderer.on(TRANSCRIPTION_STOP_RECORDING_CHANNEL, subscription)

    return () => {
      ipcRenderer.removeListener(TRANSCRIPTION_STOP_RECORDING_CHANNEL, subscription)
    }
  },
  onSocketEvent: (listener: (event: WSEnvelope) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, socketEvent: WSEnvelope): void => {
      listener(socketEvent)
    }

    ipcRenderer.on('main:socket-event', subscription)

    return () => {
      ipcRenderer.removeListener('main:socket-event', subscription)
    }
  },
  onSocketStateChange: (listener: (state: SocketConnectionState) => void) => {
    let isSubscribed = true
    const subscription = (
      _event: Electron.IpcRendererEvent,
      socketState: SocketConnectionState
    ): void => {
      if (isSubscribed) {
        listener(socketState)
      }
    }

    ipcRenderer.on('main:socket-state', subscription)
    void ipcRenderer
      .invoke('renderer:get-socket-state')
      .then((socketState: SocketConnectionState) => {
        if (isSubscribed) {
          listener(socketState)
        }
      })
      .catch((error) => {
        console.error('[preload] Failed to get initial socket state.', error)
      })

    return () => {
      isSubscribed = false
      ipcRenderer.removeListener('main:socket-state', subscription)
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
