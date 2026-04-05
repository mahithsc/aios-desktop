import { app, BrowserWindow, globalShortcut, ipcMain, Notification, screen, shell } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SocketService } from './services/SocketService'
import { createMainWindow } from './windows/createMainWindow'
import { createWidgetWindow } from './windows/createWidgetWindow'
import { SERVER_URL } from '../shared/config'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'
import {
  WIDGET_WINDOW_LEFT_OFFSET,
  WIDGET_SHORTCUT,
  WIDGET_WINDOW_MAX_HEIGHT_RATIO,
  WIDGET_WINDOW_MIN_HEIGHT,
  WIDGET_WINDOW_TOP_OFFSET,
  WIDGET_WINDOW_WIDTH
} from '../shared/window'

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

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

const attachExternalLinkHandler = (targetWindow: BrowserWindow): void => {
  targetWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
}

const getMaxWidgetHeightForDisplay = (display: Electron.Display): number =>
  Math.max(
    WIDGET_WINDOW_MIN_HEIGHT,
    Math.floor(display.workArea.height * WIDGET_WINDOW_MAX_HEIGHT_RATIO)
  )

const getWidgetBoundsForDisplay = (
  bounds: Pick<Electron.Rectangle, 'width' | 'height'>,
  display: Electron.Display,
  currentBounds?: Pick<Electron.Rectangle, 'x' | 'y'>
): Electron.Rectangle => {
  const workArea = display.workArea
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, getMaxWidgetHeightForDisplay(display))
  const defaultX = workArea.x + WIDGET_WINDOW_LEFT_OFFSET
  const defaultY = Math.min(workArea.y + WIDGET_WINDOW_TOP_OFFSET, workArea.y + workArea.height - height)
  const maxX = workArea.x + workArea.width - width
  const maxY = workArea.y + workArea.height - height

  return {
    x: clamp(currentBounds?.x ?? defaultX, workArea.x, maxX),
    y: clamp(currentBounds?.y ?? defaultY, workArea.y, maxY),
    width,
    height
  }
}

const resizeWidgetWindowToPreferredHeight = (
  targetWindow: BrowserWindow,
  preferredHeight: number
): void => {
  const currentBounds = targetWindow.getBounds()
  const display = screen.getDisplayMatching(currentBounds)
  const nextBounds = getWidgetBoundsForDisplay(
    {
      width: currentBounds.width,
      height: preferredHeight
    },
    display,
    currentBounds
  )

  if (
    nextBounds.x === currentBounds.x &&
    nextBounds.y === currentBounds.y &&
    nextBounds.width === currentBounds.width &&
    nextBounds.height === currentBounds.height
  ) {
    return
  }

  targetWindow.setBounds(nextBounds, false)
}

app.whenReady().then(() => {
  let mainWindow: BrowserWindow | null = null
  let widgetWindow: BrowserWindow | null = null

  const ensureMainWindow = (): BrowserWindow => {
    if (mainWindow?.isDestroyed()) {
      mainWindow = null
    }

    if (!mainWindow) {
      mainWindow = createMainWindow()
      attachExternalLinkHandler(mainWindow)

      mainWindow.on('closed', () => {
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.close()
        }

        widgetWindow = null
        mainWindow = null
      })
    }

    return mainWindow
  }

  const ensureWidgetWindow = (): BrowserWindow => {
    if (widgetWindow?.isDestroyed()) {
      widgetWindow = null
    }

    if (!widgetWindow) {
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      const bounds = getWidgetBoundsForDisplay(
        {
          width: WIDGET_WINDOW_WIDTH,
          height: WIDGET_WINDOW_MIN_HEIGHT
        },
        display
      )

      widgetWindow = createWidgetWindow(bounds)
      attachExternalLinkHandler(widgetWindow)

      widgetWindow.webContents.on('preferred-size-changed', (_event, preferredSize) => {
        if (!widgetWindow || widgetWindow.isDestroyed()) {
          return
        }

        resizeWidgetWindowToPreferredHeight(widgetWindow, preferredSize.height)
      })

      widgetWindow.on('closed', () => {
        widgetWindow = null
      })
    }

    return widgetWindow
  }

  const showWidgetWindow = (): void => {
    const targetWidgetWindow = ensureWidgetWindow()
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const currentBounds = targetWidgetWindow.getBounds()
    const nextBounds = getWidgetBoundsForDisplay(
      {
        width: currentBounds.width,
        height: currentBounds.height
      },
      display
    )

    targetWidgetWindow.setBounds(nextBounds, false)

    const reveal = (): void => {
      if (targetWidgetWindow.isDestroyed()) {
        return
      }

      targetWidgetWindow.show()
      app.focus({ steal: true })
      targetWidgetWindow.focus()
    }

    if (targetWidgetWindow.webContents.isLoadingMainFrame()) {
      targetWidgetWindow.webContents.once('did-finish-load', reveal)
      return
    }

    reveal()
  }

  const hideWidgetWindow = (): void => {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      return
    }

    widgetWindow.hide()
  }

  const toggleWidgetWindow = (): void => {
    if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
      hideWidgetWindow()
      return
    }

    showWidgetWindow()
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

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('renderer:send-socket-message', (_event, envelope: WSEnvelope) => {
    socketService.send(envelope)
    console.log(`[renderer] Sent socket message: ${envelope.type}`)
  })

  ipcMain.on('renderer:show-widget-window', () => {
    showWidgetWindow()
  })

  ipcMain.on('renderer:hide-widget-window', () => {
    hideWidgetWindow()
  })

  ipcMain.on('renderer:toggle-widget-window', () => {
    toggleWidgetWindow()
  })

  ipcMain.handle('renderer:get-widget-max-height', async () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      return getMaxWidgetHeightForDisplay(screen.getDisplayMatching(widgetWindow.getBounds()))
    }

    return getMaxWidgetHeightForDisplay(screen.getDisplayNearestPoint(screen.getCursorScreenPoint()))
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

  app.on('activate', () => {
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
