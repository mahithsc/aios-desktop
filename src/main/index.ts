import { app, BrowserWindow, ipcMain, Notification, screen, shell } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SocketService } from './services/SocketService'
import { uploadAttachments, type UploadAttachmentFile } from './services/AttachmentUploadService'
import { captureWidgetScreenshotAttachment } from './services/WidgetScreenshotService'
import { NativeKeyboardMonitorService } from './services/NativeKeyboardMonitorService'
import { TranscriptionService } from './services/TranscriptionService'
import { createMainWindow } from './windows/createMainWindow'
import { createOverlayWindow } from './windows/createOverlayWindow'
import {
  applyTranscriptionWindowBehavior,
  createTranscriptionWindow
} from './windows/createTranscriptionWindow'
import { createWidgetWindow } from './windows/createWidgetWindow'
import { SERVER_URL } from '../shared/config'
import { TRANSCRIPTION_HIDE_WINDOW_CHANNEL } from '../shared/transcription'
import type { WSEnvelope } from '../shared/ws'
import {
  WIDGET_WINDOW_LEFT_OFFSET,
  WIDGET_WINDOW_MAX_HEIGHT_RATIO,
  WIDGET_WINDOW_MIN_HEIGHT,
  WIDGET_WINDOW_TOP_DRAG_BOUND,
  WIDGET_WINDOW_TOP_OFFSET,
  WIDGET_WINDOW_WIDTH
} from '../shared/window'

const socketService = new SocketService((attempt) => Math.min(1_000 * 2 ** (attempt - 1), 10_000))
const nativeKeyboardMonitorService = new NativeKeyboardMonitorService()
const NOTIFICATIONS_ENABLED = false

type UploadAttachmentsPayload = {
  chatId: string
  files: UploadAttachmentFile[]
}

type CaptureWidgetScreenshotAttachmentPayload = {
  chatId: string
}

type WidgetPosition = {
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

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
  const defaultY = Math.min(
    workArea.y + WIDGET_WINDOW_TOP_OFFSET,
    workArea.y + workArea.height - height
  )
  const maxX = workArea.x + workArea.width - width
  const maxY = workArea.y + workArea.height - height

  return {
    x: clamp(currentBounds?.x ?? defaultX, workArea.x, maxX),
    y: clamp(currentBounds?.y ?? defaultY, workArea.y, maxY),
    width,
    height
  }
}

const getDraggedWidgetBoundsForDisplay = (
  bounds: Pick<Electron.Rectangle, 'width' | 'height'>,
  display: Electron.Display,
  currentBounds: Pick<Electron.Rectangle, 'x' | 'y'>
): Electron.Rectangle => {
  const workArea = display.workArea
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, getMaxWidgetHeightForDisplay(display))
  const minY = workArea.y + WIDGET_WINDOW_TOP_DRAG_BOUND

  return {
    x: currentBounds.x,
    y: Math.max(currentBounds.y, minY),
    width,
    height
  }
}

const NOTIFICATION_WINDOW_WIDTH = 320
const NOTIFICATION_WINDOW_INITIAL_HEIGHT = 96
const NOTIFICATION_WINDOW_MARGIN = 12

const getOverlayBoundsForDisplay = (
  display: Electron.Display,
  preferredHeight = NOTIFICATION_WINDOW_INITIAL_HEIGHT
): Electron.Rectangle => {
  const workArea = display.workArea
  const height = clamp(
    Math.ceil(preferredHeight),
    1,
    Math.max(1, workArea.height - NOTIFICATION_WINDOW_MARGIN * 2)
  )

  return {
    x: workArea.x + workArea.width - NOTIFICATION_WINDOW_WIDTH - NOTIFICATION_WINDOW_MARGIN,
    y: workArea.y + NOTIFICATION_WINDOW_MARGIN,
    width: NOTIFICATION_WINDOW_WIDTH,
    height
  }
}

const resizeOverlayWindowToPreferredHeight = (
  targetWindow: BrowserWindow,
  preferredHeight: number
): void => {
  const currentBounds = targetWindow.getBounds()
  const display = screen.getDisplayMatching(currentBounds)
  const nextBounds = getOverlayBoundsForDisplay(display, preferredHeight)

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

const resizeWidgetWindowToHeight = (targetWindow: BrowserWindow, nextHeight: number): void => {
  const currentBounds = targetWindow.getBounds()
  const display = screen.getDisplayMatching(currentBounds)
  const height = clamp(
    Math.ceil(nextHeight),
    WIDGET_WINDOW_MIN_HEIGHT,
    getMaxWidgetHeightForDisplay(display)
  )
  const nextBounds = getDraggedWidgetBoundsForDisplay(
    {
      width: currentBounds.width,
      height
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
  let overlayWindow: BrowserWindow | null = null
  let transcriptionWindow: BrowserWindow | null = null
  let widgetWindow: BrowserWindow | null = null
  let lastWidgetPosition: WidgetPosition | null = null

  const ensureMainWindow = (): BrowserWindow => {
    if (mainWindow?.isDestroyed()) {
      mainWindow = null
    }

    if (!mainWindow) {
      mainWindow = createMainWindow()
      attachExternalLinkHandler(mainWindow)

      mainWindow.on('closed', () => {
        mainWindow = null
      })
    }

    return mainWindow
  }

  const ensureOverlayWindow = (): BrowserWindow => {
    if (overlayWindow?.isDestroyed()) {
      overlayWindow = null
    }

    if (!overlayWindow) {
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      overlayWindow = createOverlayWindow(getOverlayBoundsForDisplay(display))
      attachExternalLinkHandler(overlayWindow)

      overlayWindow.webContents.on('preferred-size-changed', (_event, preferredSize) => {
        if (!overlayWindow || overlayWindow.isDestroyed()) {
          return
        }

        resizeOverlayWindowToPreferredHeight(overlayWindow, preferredSize.height)
      })

      overlayWindow.on('closed', () => {
        overlayWindow = null
      })
    }

    return overlayWindow
  }

  const ensureTranscriptionWindow = (): BrowserWindow => {
    if (transcriptionWindow?.isDestroyed()) {
      transcriptionWindow = null
    }

    if (!transcriptionWindow) {
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      transcriptionWindow = createTranscriptionWindow(display.bounds)
      attachExternalLinkHandler(transcriptionWindow)

      transcriptionWindow.on('closed', () => {
        transcriptionWindow = null
      })
    }

    return transcriptionWindow
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

      widgetWindow.webContents.on('before-input-event', (_event, input) => {
        if (input.type === 'keyDown' && input.key === 'Escape') {
          hideWidgetWindow()
        }
      })

      widgetWindow.on('move', () => {
        if (!widgetWindow || widgetWindow.isDestroyed()) {
          return
        }

        const { x, y } = widgetWindow.getBounds()
        lastWidgetPosition = { x, y }
      })

      widgetWindow.on('closed', () => {
        widgetWindow = null
      })
    }

    return widgetWindow
  }

  const showWidgetWindow = (): void => {
    const targetWidgetWindow = ensureWidgetWindow()
    const currentBounds = targetWidgetWindow.getBounds()
    const nextBounds = lastWidgetPosition
      ? getDraggedWidgetBoundsForDisplay(
          {
            width: currentBounds.width,
            height: currentBounds.height
          },
          screen.getDisplayNearestPoint(lastWidgetPosition),
          lastWidgetPosition
        )
      : getWidgetBoundsForDisplay(
          {
            width: currentBounds.width,
            height: currentBounds.height
          },
          screen.getDisplayMatching(currentBounds),
          currentBounds
        )

    targetWidgetWindow.setBounds(nextBounds, false)

    const reveal = (): void => {
      if (targetWidgetWindow.isDestroyed()) {
        return
      }

      targetWidgetWindow.show()
      app.focus({ steal: true })
      targetWidgetWindow.focus()
      overlayWindow?.moveTop()
    }

    if (targetWidgetWindow.webContents.isLoadingMainFrame()) {
      targetWidgetWindow.webContents.once('did-finish-load', reveal)
      return
    }

    reveal()
  }

  const syncOverlayWindowBounds = (): void => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      return
    }

    const currentBounds = overlayWindow.getBounds()
    const nextBounds = getOverlayBoundsForDisplay(
      screen.getDisplayMatching(currentBounds),
      currentBounds.height
    )
    overlayWindow.setBounds(nextBounds, false)
  }

  const showOverlayWindow = (): void => {
    const targetOverlayWindow = ensureOverlayWindow()
    const currentBounds = targetOverlayWindow.getBounds()
    const nextBounds = getOverlayBoundsForDisplay(
      screen.getDisplayMatching(currentBounds),
      currentBounds.height
    )

    targetOverlayWindow.setBounds(nextBounds, false)

    const reveal = (): void => {
      if (targetOverlayWindow.isDestroyed()) {
        return
      }

      targetOverlayWindow.showInactive()
    }

    if (targetOverlayWindow.webContents.isLoadingMainFrame()) {
      targetOverlayWindow.webContents.once('did-finish-load', reveal)
      return
    }

    reveal()
  }

  const showTranscriptionWindow = (): void => {
    const targetTranscriptionWindow = ensureTranscriptionWindow()
    const currentBounds = targetTranscriptionWindow.getBounds()
    const nextBounds = screen.getDisplayMatching(currentBounds).bounds

    targetTranscriptionWindow.setBounds(nextBounds, false)

    const reveal = (): void => {
      if (targetTranscriptionWindow.isDestroyed()) {
        return
      }

      applyTranscriptionWindowBehavior(targetTranscriptionWindow)
      targetTranscriptionWindow.showInactive()
      // Keep the island pinned to physical display bounds, not the menu-bar work area.
      targetTranscriptionWindow.setBounds(nextBounds, false)
      targetTranscriptionWindow.moveTop()
    }

    if (targetTranscriptionWindow.webContents.isLoadingMainFrame()) {
      targetTranscriptionWindow.webContents.once('did-finish-load', reveal)
      return
    }

    reveal()
  }

  const hideTranscriptionWindow = (): void => {
    if (!transcriptionWindow || transcriptionWindow.isDestroyed()) {
      return
    }

    transcriptionWindow.hide()
  }

  const transcriptionService = new TranscriptionService({
    getWindow: () => transcriptionWindow,
    showWindow: showTranscriptionWindow,
    hideWindow: hideTranscriptionWindow
  })

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

  ipcMain.on('renderer:send-socket-message', (event, envelope: WSEnvelope) => {
    try {
      socketService.send(envelope)
      console.log(`[renderer] Sent socket message: ${envelope.type}`)
    } catch (error) {
      console.warn(
        `[renderer] Dropped socket message because the socket is ${socketService.connectionState}: ${envelope.type}`,
        error
      )

      if (!event.sender.isDestroyed()) {
        event.sender.send('main:socket-state', socketService.connectionState)
      }
    }
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

  ipcMain.on('renderer:move-widget-window', (_event, position: WidgetPosition) => {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      return
    }

    const currentBounds = widgetWindow.getBounds()
    const display = screen.getDisplayNearestPoint(position)
    const nextBounds = getDraggedWidgetBoundsForDisplay(
      {
        width: currentBounds.width,
        height: currentBounds.height
      },
      display,
      position
    )

    lastWidgetPosition = {
      x: nextBounds.x,
      y: nextBounds.y
    }

    widgetWindow.setBounds(nextBounds, false)
  })

  ipcMain.on('renderer:resize-widget-window-height', (_event, height: number) => {
    if (!widgetWindow || widgetWindow.isDestroyed() || !Number.isFinite(height)) {
      return
    }

    resizeWidgetWindowToHeight(widgetWindow, height)
  })

  ipcMain.on('renderer:reset-widget-window-height', () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      return
    }

    resizeWidgetWindowToHeight(widgetWindow, WIDGET_WINDOW_MIN_HEIGHT)
  })

  ipcMain.on(TRANSCRIPTION_HIDE_WINDOW_CHANNEL, () => {
    hideTranscriptionWindow()
  })

  ipcMain.handle('renderer:get-socket-state', async () => socketService.connectionState)

  ipcMain.handle('renderer:get-widget-max-height', async () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      return getMaxWidgetHeightForDisplay(screen.getDisplayMatching(widgetWindow.getBounds()))
    }

    return getMaxWidgetHeightForDisplay(
      screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    )
  })

  ipcMain.handle('renderer:upload-attachments', async (_event, payload: UploadAttachmentsPayload) =>
    uploadAttachments(payload.chatId, payload.files)
  )

  ipcMain.handle(
    'renderer:capture-widget-screenshot-attachment',
    async (_event, payload: CaptureWidgetScreenshotAttachmentPayload) =>
      captureWidgetScreenshotAttachment({
        chatId: payload.chatId,
        widgetWindow
      })
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

    if (NOTIFICATIONS_ENABLED && message.type === 'notification.created') {
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

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('main:socket-state', state)
    }
  })

  socketService.onError((error) => {
    console.error('[socket] error', error)
  })

  screen.on('display-added', syncOverlayWindowBounds)
  screen.on('display-removed', syncOverlayWindowBounds)
  screen.on('display-metrics-changed', syncOverlayWindowBounds)

  nativeKeyboardMonitorService.onError((error) => {
    console.error('[native-keyboard] error', error)
  })
  nativeKeyboardMonitorService.onEvent((event) => {
    if (event === 'command-both-down') {
      toggleWidgetWindow()
    }

    if (event === 'function-key-down') {
      transcriptionService.startRecording()
    }

    if (event === 'function-key-up') {
      transcriptionService.stopRecording()
    }
  })
  nativeKeyboardMonitorService.start()

  socketService.connect(SERVER_URL + '/ws')
  ensureMainWindow()
  if (NOTIFICATIONS_ENABLED) {
    showOverlayWindow()
  }

  app.on('activate', () => {
    const targetMainWindow = ensureMainWindow()
    if (NOTIFICATIONS_ENABLED) {
      showOverlayWindow()
    }

    if (targetMainWindow.isMinimized()) {
      targetMainWindow.restore()
    }

    if (!targetMainWindow.isVisible()) {
      targetMainWindow.show()
    }

    targetMainWindow.focus()
  })
})

app.on('before-quit', () => {
  nativeKeyboardMonitorService.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
