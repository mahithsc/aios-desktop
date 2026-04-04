import { app, BrowserWindow, globalShortcut, ipcMain, Notification, screen, shell } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SocketService } from './services/SocketService'
import { createMainWindow, sharedWindowOptions } from './windows/createMainWindow'
import { SERVER_URL } from '../shared/config'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'
import {
  parseChildWindowName,
  type ChildWindowBounds,
  type ChildWindowRegistration,
  type ChildWindowUpdate,
  WIDGET_SHORTCUT,
  WIDGET_WINDOW_KEY,
  WIDGET_WINDOW_TOP_OFFSET
} from '../shared/window'

const socketService = new SocketService((attempt) => Math.min(1_000 * 2 ** (attempt - 1), 10_000))
const childWindowRegistrations = new Map<string, ChildWindowRegistration>()
const childWindows = new Map<string, BrowserWindow>()

type UploadAttachmentFile = {
  name: string
  type: string
  bytes: ArrayBuffer
}

type UploadAttachmentsPayload = {
  chatId: string
  files: UploadAttachmentFile[]
}

const getUploadErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail
    }
  } catch {
    // Ignore JSON parsing errors and fall back to the response status text.
  }

  return response.statusText || 'Attachment upload failed.'
}

const getDefaultWidgetBounds = (bounds: ChildWindowBounds): Electron.Rectangle => {
  const display = screen.getPrimaryDisplay()
  const { x, y, width } = display.workArea

  return {
    x: Math.round(x + (width - bounds.width) / 2),
    y: y + WIDGET_WINDOW_TOP_OFFSET,
    width: bounds.width,
    height: bounds.height
  }
}

const resolveChildWindowBounds = (
  windowKey: string,
  bounds: ChildWindowBounds
): Electron.Rectangle => {
  if (bounds.x !== undefined && bounds.y !== undefined) {
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    }
  }

  if (windowKey === WIDGET_WINDOW_KEY) {
    return getDefaultWidgetBounds(bounds)
  }

  return {
    x: 0,
    y: 0,
    width: bounds.width,
    height: bounds.height
  }
}

const toChildWindowOptions = (
  registration: ChildWindowRegistration
): Electron.BrowserWindowConstructorOptions => {
  const bounds = resolveChildWindowBounds(registration.windowKey, registration.options.bounds)

  return {
    ...sharedWindowOptions,
    ...bounds,
    title: registration.title,
    show: false,
    frame: registration.options.frame,
    transparent: registration.options.transparent,
    backgroundColor: registration.options.backgroundColor,
    alwaysOnTop: registration.options.alwaysOnTop,
    skipTaskbar: registration.options.skipTaskbar,
    resizable: registration.options.resizable,
    minimizable: registration.options.minimizable,
    maximizable: registration.options.maximizable,
    fullscreenable: registration.options.fullscreenable,
    movable: registration.options.movable,
    hasShadow: registration.options.hasShadow,
    acceptFirstMouse: registration.options.acceptFirstMouse,
    hiddenInMissionControl: registration.options.hiddenInMissionControl,
    ...(process.platform === 'darwin' && registration.options.type
      ? { type: registration.options.type }
      : {})
  }
}

const applyChildWindowRegistration = (
  childWindow: BrowserWindow,
  registration: ChildWindowRegistration
): void => {
  const bounds = resolveChildWindowBounds(registration.windowKey, registration.options.bounds)

  childWindow.setTitle(registration.title)
  childWindow.setBounds(bounds, false)
  childWindow.setAlwaysOnTop(
    registration.options.alwaysOnTop ?? false,
    registration.options.alwaysOnTopLevel ?? 'normal'
  )

  if (process.platform === 'darwin') {
    childWindow.setWindowButtonVisibility(registration.windowKey !== WIDGET_WINDOW_KEY)
  }

  if (registration.options.visibleOnAllWorkspaces !== undefined) {
    childWindow.setVisibleOnAllWorkspaces(registration.options.visibleOnAllWorkspaces, {
      visibleOnFullScreen: registration.options.visibleOnFullScreen ?? false
    })
  }

  if (registration.options.skipTaskbar !== undefined) {
    childWindow.setSkipTaskbar(registration.options.skipTaskbar)
  }

  if (registration.options.hasShadow !== undefined) {
    childWindow.setHasShadow(registration.options.hasShadow)
  }

  if (registration.options.resizable !== undefined) {
    childWindow.setResizable(registration.options.resizable)
  }

  if (registration.options.minimizable !== undefined) {
    childWindow.setMinimizable(registration.options.minimizable)
  }

  if (registration.options.maximizable !== undefined) {
    childWindow.setMaximizable(registration.options.maximizable)
  }

  if (registration.options.fullscreenable !== undefined) {
    childWindow.setFullScreenable(registration.options.fullscreenable)
  }

  if (registration.options.movable !== undefined) {
    childWindow.setMovable(registration.options.movable)
  }
}

const mergeChildWindowRegistration = (
  current: ChildWindowRegistration,
  update: ChildWindowUpdate
): ChildWindowRegistration => ({
  ...current,
  title: update.title ?? current.title,
  options: update.options
    ? {
        ...current.options,
        ...update.options,
        bounds: update.options.bounds
          ? {
              ...current.options.bounds,
              ...update.options.bounds
            }
          : current.options.bounds
      }
    : current.options
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  let mainWindow: BrowserWindow | null = null

  const ensureMainWindow = (): BrowserWindow => {
    if (mainWindow?.isDestroyed()) {
      mainWindow = null
    }

    if (!mainWindow) {
      mainWindow = createMainWindow()
      mainWindow.webContents.setWindowOpenHandler((details) => {
        const childWindowKey = parseChildWindowName(details.frameName)

        if (!childWindowKey) {
          shell.openExternal(details.url)
          return { action: 'deny' }
        }

        const registration = childWindowRegistrations.get(childWindowKey)
        if (!registration) {
          return { action: 'deny' }
        }

        return {
          action: 'allow',
          overrideBrowserWindowOptions: toChildWindowOptions(registration)
        }
      })
      mainWindow.webContents.on('did-create-window', (childWindow, details) => {
        const childWindowKey = parseChildWindowName(details.frameName)
        if (!childWindowKey) {
          return
        }

        childWindows.set(childWindowKey, childWindow)
        childWindow.webContents.setWindowOpenHandler((windowDetails) => {
          shell.openExternal(windowDetails.url)
          return { action: 'deny' }
        })

        const registration = childWindowRegistrations.get(childWindowKey)
        if (registration) {
          applyChildWindowRegistration(childWindow, registration)
        }

        childWindow.on('closed', () => {
          childWindows.delete(childWindowKey)
        })
      })
      mainWindow.on('closed', () => {
        childWindows.forEach((childWindow) => {
          if (!childWindow.isDestroyed()) {
            childWindow.close()
          }
        })
        childWindows.clear()
        mainWindow = null
      })
    }

    return mainWindow
  }

  const sendWidgetToggleRequested = (): void => {
    const targetMainWindow = ensureMainWindow()

    if (targetMainWindow.isMinimized()) {
      targetMainWindow.restore()
    }

    if (!targetMainWindow.isVisible()) {
      targetMainWindow.show()
    }

    const emit = (): void => {
      if (!targetMainWindow.isDestroyed()) {
        targetMainWindow.webContents.send('main:toggle-widget-window-requested')
      }
    }

    if (targetMainWindow.webContents.isLoadingMainFrame()) {
      targetMainWindow.webContents.once('did-finish-load', emit)
      return
    }

    emit()
  }

  const registerWidgetShortcut = (): void => {
    if (globalShortcut.isRegistered(WIDGET_SHORTCUT)) {
      return
    }

    const didRegister = globalShortcut.register(WIDGET_SHORTCUT, () => {
      sendWidgetToggleRequested()
    })

    if (!didRegister) {
      console.warn(`[widget] Failed to register shortcut ${WIDGET_SHORTCUT}`)
    }
  }

  const showNativeNotification = (title: string, body: string): void => {
    if (!Notification.isSupported()) {
      return
    }

    const nativeNotification = new Notification({
      title,
      body
    })

    nativeNotification.on('click', () => {
      const targetMainWindow = ensureMainWindow()

      if (targetMainWindow.isMinimized()) {
        targetMainWindow.restore()
      }

      if (!targetMainWindow.isVisible()) {
        targetMainWindow.show()
      }

      app.focus({ steal: true })
      targetMainWindow.focus()
    })

    nativeNotification.show()
  }
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('renderer:send-socket-message', (_event, envelope: WSEnvelope) => {
    socketService.send(envelope)
    console.log(`[renderer] Sent socket message: ${envelope.type}`)
  })

  ipcMain.handle(
    'renderer:register-child-window',
    async (_event, registration: ChildWindowRegistration): Promise<void> => {
      childWindowRegistrations.set(registration.windowKey, registration)

      const existingChildWindow = childWindows.get(registration.windowKey)
      if (existingChildWindow && !existingChildWindow.isDestroyed()) {
        applyChildWindowRegistration(existingChildWindow, registration)
      }
    }
  )

  ipcMain.on('renderer:update-child-window', (_event, update: ChildWindowUpdate) => {
    const currentRegistration = childWindowRegistrations.get(update.windowKey)
    if (!currentRegistration) {
      return
    }

    const nextRegistration = mergeChildWindowRegistration(currentRegistration, update)
    childWindowRegistrations.set(update.windowKey, nextRegistration)

    const existingChildWindow = childWindows.get(update.windowKey)
    if (existingChildWindow && !existingChildWindow.isDestroyed()) {
      applyChildWindowRegistration(existingChildWindow, nextRegistration)
    }
  })

  ipcMain.on('renderer:show-child-window', (_event, windowKey: string) => {
    const childWindow = childWindows.get(windowKey)
    if (!childWindow || childWindow.isDestroyed()) {
      return
    }

    childWindow.show()
    app.focus({ steal: true })
    childWindow.focus()
  })

  ipcMain.handle(
    'renderer:upload-attachments',
    async (_event, payload: UploadAttachmentsPayload): Promise<MessageAttachment[]> => {
      const formData = new FormData()
      formData.append('chatId', payload.chatId)

      for (const file of payload.files) {
        const blob = new Blob([new Uint8Array(file.bytes)], {
          type: file.type || 'application/octet-stream'
        })
        formData.append('files', blob, file.name)
      }

      const response = await fetch(`${SERVER_URL}/attachments`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(await getUploadErrorMessage(response))
      }

      const responsePayload = (await response.json()) as { attachments?: MessageAttachment[] }
      return Array.isArray(responsePayload.attachments) ? responsePayload.attachments : []
    }
  )

  ipcMain.on(
    'renderer:log',
    (
      _event,
      payload: {
        level?: 'debug' | 'info' | 'warn' | 'error'
        message?: string
        details?: unknown
      }
    ) => {
      const level = payload.level ?? 'debug'
      const message = payload.message ?? 'Renderer log'
      const logger =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : level === 'info'
              ? console.info
              : console.debug

      logger(`[renderer] ${message}`, payload.details)
    }
  )

  socketService.onMessage((message) => {
    console.log(`[socket] event -> ${message.type}`, message)

    if (message.type === 'notification.created') {
      showNativeNotification(message.data.title, message.data.body)
    }

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('main:socket-event', message)
    }
  })

  socketService.onStateChange((state) => {
    if (is.dev) {
      console.log(`[socket] state -> ${state}`)
    }
  })

  socketService.onError((error) => {
    console.error('[socket] error', error)
  })

  socketService.connect(SERVER_URL + '/ws')
  ensureMainWindow()
  registerWidgetShortcut()

  app.on('activate', function () {
    registerWidgetShortcut()
    const targetMainWindow = ensureMainWindow()

    if (targetMainWindow.isMinimized()) {
      targetMainWindow.restore()
    }

    if (!targetMainWindow.isVisible()) {
      targetMainWindow.show()
    }

    targetMainWindow.focus()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  socketService.destroy()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
