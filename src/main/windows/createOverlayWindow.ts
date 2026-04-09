import { BrowserWindow } from 'electron'
import { sharedWindowOptions } from './createMainWindow'
import { loadRendererWindow } from './loadRendererWindow'
import { OVERLAY_WINDOW_MODE } from '../../shared/window'

export function createOverlayWindow(bounds: Electron.Rectangle): BrowserWindow {
  const overlayWindow = new BrowserWindow({
    ...sharedWindowOptions,
    ...bounds,
    show: false,
    title: 'Aios Overlay',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    acceptFirstMouse: false,
    hiddenInMissionControl: true
  })

  overlayWindow.setAlwaysOnTop(true, process.platform === 'darwin' ? 'screen-saver' : 'normal')
  overlayWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    ...(process.platform === 'darwin' ? { skipTransformProcessType: true } : {})
  })
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.setContentProtection(true)

  if (process.platform === 'darwin') {
    overlayWindow.setWindowButtonVisibility(false)
  }

  void loadRendererWindow(overlayWindow, OVERLAY_WINDOW_MODE)

  return overlayWindow
}
