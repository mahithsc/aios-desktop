import type { BrowserWindowConstructorOptions } from 'electron'
import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import icon from '../../../resources/icon.png?asset'
import { DESKTOP_WINDOW_MODE } from '../../shared/window'
import { loadRendererWindow } from './loadRendererWindow'

const sharedWindowOptions: BrowserWindowConstructorOptions = {
  autoHideMenuBar: true,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false
  },
  ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
  ...(process.platform === 'linux' ? { icon } : {})
}

export { sharedWindowOptions }

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    ...sharedWindowOptions
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRendererWindow(mainWindow, DESKTOP_WINDOW_MODE.main)

  return mainWindow
}
