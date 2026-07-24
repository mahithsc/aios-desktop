import type { BrowserWindow } from 'electron'
import { app, clipboard, ipcMain } from 'electron'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import {
  TRANSCRIPTION_RECORDING_COMPLETE_CHANNEL,
  TRANSCRIPTION_RECORDING_ERROR_CHANNEL,
  TRANSCRIPTION_START_RECORDING_CHANNEL,
  TRANSCRIPTION_STOP_RECORDING_CHANNEL,
  type TranscriptionRecordingErrorPayload,
  type TranscriptionRecordingPayload,
  type TranscriptionRecordingSavedPayload
} from '../../shared/transcription'

type TranscriptionRecordingState = 'idle' | 'starting' | 'recording' | 'stopping'

type GroqTranscriptionResponse = {
  text?: unknown
}

const GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3'
const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const PASTE_COMMAND_BINARY_NAME = 'PasteCommand'
const PASTE_CLIPBOARD_RESTORE_DELAY_MS = 500
const LATEST_TRANSCRIPTION_RECORDING_BASENAME = 'latest-transcription'
const TRANSCRIPTION_RECORDING_FILENAME_PREFIX = 'transcription-'
const TRANSCRIPTION_RECORDING_EXTENSIONS = new Set(['m4a', 'ogg', 'wav', 'webm'])

const execFileAsync = promisify(execFile)

type TranscriptionServiceOptions = {
  getWindow: () => BrowserWindow | null
  showWindow: () => void
  hideWindow: () => void
}

const getRecordingExtension = (mimeType: string): string => {
  const normalizedMimeType = mimeType.split(';')[0]?.trim().toLowerCase()

  if (normalizedMimeType === 'audio/mp4' || normalizedMimeType === 'audio/mpeg') {
    return 'm4a'
  }

  if (normalizedMimeType === 'audio/ogg') {
    return 'ogg'
  }

  if (normalizedMimeType === 'audio/wav' || normalizedMimeType === 'audio/wave') {
    return 'wav'
  }

  return 'webm'
}

const buildRecordingFilename = (mimeType: string): string => {
  return `${LATEST_TRANSCRIPTION_RECORDING_BASENAME}.${getRecordingExtension(mimeType)}`
}

const isTranscriptionRecordingFilename = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase()

  if (!extension || !TRANSCRIPTION_RECORDING_EXTENSIONS.has(extension)) {
    return false
  }

  return (
    fileName.startsWith(TRANSCRIPTION_RECORDING_FILENAME_PREFIX) ||
    fileName.startsWith(`${LATEST_TRANSCRIPTION_RECORDING_BASENAME}.`)
  )
}

const removePreviousTranscriptionRecordings = async (
  recordingsDirectory: string,
  latestFileName: string
): Promise<void> => {
  const entries = await readdir(recordingsDirectory, { withFileTypes: true })
  const previousRecordingFileNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => fileName !== latestFileName && isTranscriptionRecordingFilename(fileName))

  await Promise.all(
    previousRecordingFileNames.map((fileName) => unlink(join(recordingsDirectory, fileName)))
  )
}

const getGroqApiKey = (): string | null => {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  return apiKey ? apiKey : null
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

export class TranscriptionService {
  private state: TranscriptionRecordingState = 'idle'

  constructor(private readonly options: TranscriptionServiceOptions) {
    ipcMain.handle(
      TRANSCRIPTION_RECORDING_COMPLETE_CHANNEL,
      async (_event, payload: TranscriptionRecordingPayload) => this.saveRecording(payload)
    )

    ipcMain.on(
      TRANSCRIPTION_RECORDING_ERROR_CHANNEL,
      (_event, payload: TranscriptionRecordingErrorPayload) => {
        console.error('[transcription] recording error', payload.message)
        this.state = 'idle'
        this.options.hideWindow()
      }
    )
  }

  startRecording(): void {
    if (this.state !== 'idle') {
      return
    }

    this.state = 'starting'
    this.options.showWindow()
    this.sendToRenderer(TRANSCRIPTION_START_RECORDING_CHANNEL)
    this.state = 'recording'
  }

  stopRecording(): void {
    if (this.state === 'idle') {
      return
    }

    this.state = 'stopping'
    this.sendToRenderer(TRANSCRIPTION_STOP_RECORDING_CHANNEL)
  }

  private sendToRenderer(channel: string): void {
    const targetWindow = this.options.getWindow()

    if (!targetWindow || targetWindow.isDestroyed()) {
      this.state = 'idle'
      console.warn(`[transcription] Cannot send ${channel}; transcription window is unavailable.`)
      return
    }

    const send = (): void => {
      if (targetWindow.isDestroyed()) {
        this.state = 'idle'
        return
      }

      targetWindow.webContents.send(channel)
    }

    if (targetWindow.webContents.isLoadingMainFrame()) {
      targetWindow.webContents.once('did-finish-load', send)
      return
    }

    send()
  }

  private async saveRecording(
    payload: TranscriptionRecordingPayload
  ): Promise<TranscriptionRecordingSavedPayload> {
    const recordingBytes = Buffer.from(payload.bytes)

    if (recordingBytes.byteLength === 0) {
      this.state = 'idle'
      this.options.hideWindow()
      throw new Error('Transcription recording returned an empty audio file.')
    }

    const recordingsDirectory = join(app.getAppPath(), 'recording')
    await mkdir(recordingsDirectory, { recursive: true })

    const fileName = buildRecordingFilename(payload.mimeType)
    const filePath = join(recordingsDirectory, fileName)
    const temporaryFilePath = join(recordingsDirectory, `${fileName}.tmp`)

    await writeFile(temporaryFilePath, recordingBytes)
    await removePreviousTranscriptionRecordings(recordingsDirectory, fileName)
    await rename(temporaryFilePath, filePath)

    const savedRecording: TranscriptionRecordingSavedPayload = {
      filePath,
      mimeType: payload.mimeType,
      sizeBytes: recordingBytes.byteLength,
      startedAt: payload.startedAt,
      endedAt: payload.endedAt
    }

    console.log('[transcription] Saved recording', savedRecording)

    try {
      const transcript = await this.transcribeWithGroq({
        bytes: recordingBytes,
        fileName,
        mimeType: payload.mimeType
      })

      if (transcript) {
        savedRecording.transcript = transcript
        console.log('[transcription] Groq transcript:')
        console.log(transcript)

        try {
          await this.pasteTranscript(transcript)
        } catch (pasteError) {
          console.error('[transcription] Failed to paste transcript', pasteError)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Groq transcription failed.'
      savedRecording.transcriptionError = message
      console.error('[transcription] Groq transcription failed', error)
    }

    this.state = 'idle'

    return savedRecording
  }

  private async transcribeWithGroq({
    bytes,
    fileName,
    mimeType
  }: {
    bytes: Buffer
    fileName: string
    mimeType: string
  }): Promise<string | null> {
    const apiKey = getGroqApiKey()
    if (!apiKey) {
      console.warn('[transcription] GROQ_API_KEY is not set; skipping Groq transcription.')
      return null
    }

    const audioArrayBuffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(audioArrayBuffer).set(bytes)

    const formData = new FormData()
    const audioBlob = new Blob([audioArrayBuffer], { type: mimeType || 'audio/webm' })
    formData.append('file', audioBlob, fileName)
    formData.append('model', GROQ_TRANSCRIPTION_MODEL)
    formData.append('response_format', 'json')

    const response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Groq transcription failed with ${response.status} ${response.statusText}${
          errorText ? `: ${errorText}` : ''
        }`
      )
    }

    const transcription = (await response.json()) as GroqTranscriptionResponse
    if (typeof transcription.text !== 'string') {
      throw new Error('Groq transcription response did not include text.')
    }

    return transcription.text
  }

  private getPasteCommandPath(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'native', PASTE_COMMAND_BINARY_NAME)
    }

    return join(app.getAppPath(), 'resources', 'native', PASTE_COMMAND_BINARY_NAME)
  }

  private async pasteTranscript(transcript: string): Promise<void> {
    const trimmedTranscript = transcript.trim()
    if (!trimmedTranscript) {
      return
    }

    const pasteCommandPath = this.getPasteCommandPath()
    if (!existsSync(pasteCommandPath)) {
      console.warn(`[transcription] Paste command binary was not found at ${pasteCommandPath}.`)
      return
    }

    const previousClipboardText = clipboard.readText()
    clipboard.writeText(trimmedTranscript)

    try {
      const { stdout, stderr } = await execFileAsync(pasteCommandPath)
      const stdoutMessage = stdout.trim()
      const stderrMessage = stderr.trim()

      if (stdoutMessage) {
        console.log(`[transcription] PasteCommand stdout: ${stdoutMessage}`)
      }

      if (stderrMessage) {
        console.warn(`[transcription] PasteCommand stderr: ${stderrMessage}`)
      }

      await wait(PASTE_CLIPBOARD_RESTORE_DELAY_MS)
    } finally {
      clipboard.writeText(previousClipboardText)
    }
  }
}
