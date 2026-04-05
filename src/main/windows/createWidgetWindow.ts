import { BrowserWindow } from 'electron'
import { sharedWindowOptions } from './createMainWindow'
import { loadRendererWindow } from './loadRendererWindow'
import { WIDGET_WINDOW_MODE } from '../../shared/window'

export function createWidgetWindow(bounds: Electron.Rectangle): BrowserWindow {
  const widgetWindow = new BrowserWindow({
    ...sharedWindowOptions,
    ...bounds,
    show: false,
    title: 'Aios Widget',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: true,
    hasShadow: false,
    acceptFirstMouse: true,
    hiddenInMissionControl: true,
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    webPreferences: {
      ...sharedWindowOptions.webPreferences,
      enablePreferredSizeMode: true
    }
  })

  widgetWindow.setAlwaysOnTop(true, 'floating')
  widgetWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  })

  if (process.platform === 'darwin') {
    widgetWindow.setWindowButtonVisibility(false)
  }

  void loadRendererWindow(widgetWindow, WIDGET_WINDOW_MODE)

  return widgetWindow
}
