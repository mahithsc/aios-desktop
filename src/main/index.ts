import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SocketService } from './services/SocketService'
import { createMainWindow } from './windows/createMainWindow'
import { SERVER_URL } from '../shared/config'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'

const socketService = new SocketService((attempt) => Math.min(1_000 * 2 ** (attempt - 1), 10_000))

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

  const showNativeNotification = (title: string, body: string): void => {
    if (!Notification.isSupported()) {
      return
    }

    const nativeNotification = new Notification({
      title,
      body
    })

    nativeNotification.on('click', () => {
      if (mainWindow?.isDestroyed()) {
        mainWindow = null
      }

      if (!mainWindow) {
        mainWindow = createMainWindow()
        return
      }

      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }

      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }

      app.focus({ steal: true })
      mainWindow.focus()
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

  ipcMain.on('overlay:set-ignore-mouse-events', (event, ignore: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win === mainWindow) return
    console.log('[overlay] set-ignore-mouse-events:', ignore)
    win.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.on('renderer:send-socket-message', (_event, envelope: WSEnvelope) => {
    socketService.send(envelope)
    console.log(`[renderer] Sent socket message: ${envelope.type}`)
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
  mainWindow = createMainWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
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
  socketService.destroy()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
