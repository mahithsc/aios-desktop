import { BrowserWindow } from 'electron'
import { join } from 'path'
import { TRANSCRIPTION_WINDOW_MODE } from '../../shared/window'
import { loadRendererWindow } from './loadRendererWindow'

const TRANSCRIPTION_WINDOW_ALWAYS_ON_TOP_LEVEL: Parameters<BrowserWindow['setAlwaysOnTop']>[1] =
  process.platform === 'darwin' ? 'screen-saver' : 'status'

export const applyTranscriptionWindowBehavior = (transcriptionWindow: BrowserWindow): void => {
  transcriptionWindow.setAlwaysOnTop(true, TRANSCRIPTION_WINDOW_ALWAYS_ON_TOP_LEVEL)
  transcriptionWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    ...(process.platform === 'darwin' ? { skipTransformProcessType: true } : {})
  })
}

export function createTranscriptionWindow(bounds: Electron.Rectangle): BrowserWindow {
  const transcriptionWindow = new BrowserWindow({
    ...bounds,
    show: false,
    title: 'Aios Transcription',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    hiddenInMissionControl: true,
    enableLargerThanScreen: true,
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  applyTranscriptionWindowBehavior(transcriptionWindow)
  transcriptionWindow.setIgnoreMouseEvents(true)
  transcriptionWindow.setContentProtection(true)

  if (process.platform === 'darwin') {
    transcriptionWindow.setWindowButtonVisibility(false)
  }

  void loadRendererWindow(transcriptionWindow, TRANSCRIPTION_WINDOW_MODE)

  return transcriptionWindow
}
