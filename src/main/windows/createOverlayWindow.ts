import { BrowserWindow } from 'electron'
import { sharedWindowOptions } from './createMainWindow'
import { loadRendererWindow } from './loadRendererWindow'
import { OVERLAY_WINDOW_MODE } from '../../shared/window'

export function createOverlayWindow(bounds: Electron.Rectangle): BrowserWindow {
  const overlayWindow = new BrowserWindow({
    ...sharedWindowOptions,
    ...bounds,
    show: false,
    title: 'Aios Notification',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: false,
    focusable: true,
    skipTaskbar: true,
    hasShadow: false,
    acceptFirstMouse: true,
    hiddenInMissionControl: true,
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    webPreferences: {
      ...sharedWindowOptions.webPreferences,
      enablePreferredSizeMode: true
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'status')
  overlayWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    ...(process.platform === 'darwin' ? { skipTransformProcessType: true } : {})
  })
  overlayWindow.setContentProtection(true)

  if (process.platform === 'darwin') {
    overlayWindow.setWindowButtonVisibility(false)
  }

  void loadRendererWindow(overlayWindow, OVERLAY_WINDOW_MODE)

  return overlayWindow
}
