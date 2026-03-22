import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'

const preloadPath = join(__dirname, '../preload/index.js')

const sharedWindowOptions = {
  autoHideMenuBar: true,
  ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
  ...(process.platform === 'linux' ? { icon } : {}),
  webPreferences: {
    preload: preloadPath,
    sandbox: false
  }
}

const getChildWindowOptions = (): Electron.BrowserWindowConstructorOptions => {
  const overlayDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = overlayDisplay.bounds

  return {
    ...sharedWindowOptions,
    show: false,
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    titleBarStyle: 'default' as const,
    trafficLightPosition: { x: -100, y: -100 },
    hiddenInMissionControl: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: false,
    alwaysOnTop: true
  }
}

const configureChildWindow = (window: BrowserWindow): void => {
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    // Prevent macOS from transforming the app into a UIElement app,
    // which hides the Dock icon when the overlay window is shown.
    skipTransformProcessType: process.platform === 'darwin'
  })
  window.setIgnoreMouseEvents(true, {
    forward: true
  })

  window.once('ready-to-show', () => {
    window.showInactive()
  })
}

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
    if (details.url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: getChildWindowOptions()
      }
    }

    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-create-window', (window) => {
    configureChildWindow(window)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
