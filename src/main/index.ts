import { app, BrowserWindow, globalShortcut, ipcMain, Notification } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SocketService } from './services/SocketService'
import { createMainWindow } from './windows/createMainWindow'
import { createWidgetWindow, getWidgetWindowBounds } from './windows/createWidgetWindow'
import { SERVER_URL } from '../shared/config'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'
import { WIDGET_SHORTCUT } from '../shared/window'

const socketService = new SocketService((attempt) => Math.min(1_000 * 2 ** (attempt - 1), 10_000))
let isQuitting = false

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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  let mainWindow: BrowserWindow | null = null
  let widgetWindow: BrowserWindow | null = null

  const ensureMainWindow = (): BrowserWindow => {
    if (mainWindow?.isDestroyed()) {
      mainWindow = null
    }

    if (!mainWindow) {
      mainWindow = createMainWindow()
      mainWindow.on('closed', () => {
        mainWindow = null
      })
    }

    return mainWindow
  }

  const syncWidgetBounds = (): void => {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      return
    }

    widgetWindow.setBounds(getWidgetWindowBounds(), false)
  }

  const emitWidgetVisibilityChange = (visible: boolean): void => {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      return
    }

    widgetWindow.webContents.send('main:widget-visibility-changed', visible)
  }

  const hideWidgetWindow = (): void => {
    if (!widgetWindow || widgetWindow.isDestroyed() || !widgetWindow.isVisible()) {
      return
    }

    widgetWindow.hide()
    emitWidgetVisibilityChange(false)
  }

  const showWidgetWindow = (): void => {
    const targetWidgetWindow = ensureWidgetWindow()
    syncWidgetBounds()

    if (process.platform === 'darwin') {
      targetWidgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      targetWidgetWindow.setAlwaysOnTop(true, 'floating')
    } else {
      targetWidgetWindow.setAlwaysOnTop(true)
    }

    targetWidgetWindow.show()
    app.focus({ steal: true })
    targetWidgetWindow.focus()
    emitWidgetVisibilityChange(true)
  }

  const toggleWidgetWindow = (): void => {
    if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
      hideWidgetWindow()
      return
    }

    showWidgetWindow()
  }

  const ensureWidgetWindow = (): BrowserWindow => {
    if (widgetWindow?.isDestroyed()) {
      widgetWindow = null
    }

    if (!widgetWindow) {
      widgetWindow = createWidgetWindow()
      widgetWindow.on('close', (event) => {
        if (isQuitting) {
          return
        }

        event.preventDefault()
        hideWidgetWindow()
      })
      widgetWindow.on('closed', () => {
        widgetWindow = null
      })
    }

    return widgetWindow
  }

  const registerWidgetShortcut = (): void => {
    if (globalShortcut.isRegistered(WIDGET_SHORTCUT)) {
      return
    }

    const didRegister = globalShortcut.register(WIDGET_SHORTCUT, () => {
      toggleWidgetWindow()
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

  ipcMain.on('renderer:toggle-widget-window', () => {
    toggleWidgetWindow()
  })

  ipcMain.on('renderer:hide-widget-window', () => {
    hideWidgetWindow()
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
  ensureWidgetWindow()
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
  isQuitting = true
  socketService.destroy()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
