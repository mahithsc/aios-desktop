import { ElectronAPI } from '@electron-toolkit/preload'
import type { MessageAttachment } from '../shared/chat'
import type {
  TranscriptionRecordingErrorPayload,
  TranscriptionRecordingPayload,
  TranscriptionRecordingSavedPayload
} from '../shared/transcription'
import type { SocketConnectionState } from '../main/services/SocketService'
import type { WSEnvelope } from '../shared/ws'

interface UploadAttachmentFile {
  name: string
  type: string
  bytes: ArrayBuffer
}

interface WidgetPosition {
  x: number
  y: number
}

interface AppAPI {
  sendSocketMessage: (message: WSEnvelope) => void
  showWidgetWindow: () => void
  hideWidgetWindow: () => void
  toggleWidgetWindow: () => void
  moveWidgetWindow: (position: WidgetPosition) => void
  resizeWidgetWindowToHeight: (height: number) => void
  resetWidgetWindowHeight: () => void
  getWidgetMaxHeight: () => Promise<number>
  uploadAttachments: (chatId: string, files: UploadAttachmentFile[]) => Promise<MessageAttachment[]>
  captureWidgetScreenshotAttachment: (chatId: string) => Promise<MessageAttachment>
  completeTranscriptionRecording: (
    payload: TranscriptionRecordingPayload
  ) => Promise<TranscriptionRecordingSavedPayload>
  hideTranscriptionWindow: () => void
  reportTranscriptionRecordingError: (payload: TranscriptionRecordingErrorPayload) => void
  onTranscriptionStartRecording: (listener: () => void) => () => void
  onTranscriptionStopRecording: (listener: () => void) => () => void
  onSocketEvent: (listener: (event: WSEnvelope) => void) => () => void
  onSocketStateChange: (listener: (state: SocketConnectionState) => void) => () => void
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
