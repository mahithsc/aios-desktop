import type { BrowserWindowConstructorOptions } from 'electron'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import icon from '../../../resources/icon.png?asset'

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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
