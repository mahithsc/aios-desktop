import { BrowserWindow, screen } from 'electron'
import {
  DESKTOP_WINDOW_MODE,
  WIDGET_WINDOW_HEIGHT,
  WIDGET_WINDOW_TOP_OFFSET,
  WIDGET_WINDOW_WIDTH
} from '../../shared/window'
import { loadRendererWindow } from './loadRendererWindow'
import { sharedWindowOptions } from './createMainWindow'

export const getWidgetWindowBounds = (): Electron.Rectangle => {
  const display = screen.getPrimaryDisplay()
  const { x, y, width } = display.workArea

  return {
    x: Math.round(x + (width - WIDGET_WINDOW_WIDTH) / 2),
    y: y + WIDGET_WINDOW_TOP_OFFSET,
    width: WIDGET_WINDOW_WIDTH,
    height: WIDGET_WINDOW_HEIGHT
  }
}

export function createWidgetWindow(): BrowserWindow {
  const widgetWindow = new BrowserWindow({
    ...sharedWindowOptions,
    ...getWidgetWindowBounds(),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: true,
    hasShadow: true,
    acceptFirstMouse: true,
    hiddenInMissionControl: true,
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {})
  })

  if (process.platform === 'darwin') {
    widgetWindow.setAlwaysOnTop(true, 'floating')
    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    widgetWindow.setAlwaysOnTop(true)
  }

  widgetWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  loadRendererWindow(widgetWindow, DESKTOP_WINDOW_MODE.widget)

  return widgetWindow
}
