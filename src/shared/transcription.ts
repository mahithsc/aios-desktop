export const TRANSCRIPTION_START_RECORDING_CHANNEL = 'main:transcription-start-recording'
export const TRANSCRIPTION_STOP_RECORDING_CHANNEL = 'main:transcription-stop-recording'
export const TRANSCRIPTION_RECORDING_COMPLETE_CHANNEL =
  'renderer:transcription-recording-complete'
export const TRANSCRIPTION_RECORDING_ERROR_CHANNEL = 'renderer:transcription-recording-error'
export const TRANSCRIPTION_HIDE_WINDOW_CHANNEL = 'renderer:transcription-hide-window'

export type TranscriptionRecordingPayload = {
  startedAt: number
  endedAt: number
  mimeType: string
  bytes: ArrayBuffer
}

export type TranscriptionRecordingSavedPayload = {
  filePath: string
  mimeType: string
  sizeBytes: number
  startedAt: number
  endedAt: number
  transcript?: string
  transcriptionError?: string
}

export type TranscriptionRecordingErrorPayload = {
  message: string
}
