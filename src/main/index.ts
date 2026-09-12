import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { BoxClient } from './services/BoxClient'
import { DiscoveryService } from './services/DiscoveryService'
import { AuthService } from './services/AuthService'
import { AppAccessService } from './services/AppAccessService'
import { createMainWindow } from './windows/createMainWindow'
import { SERVER_URL } from '../shared/config'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'
import type { CommandResult } from '../shared/device'
import type { AppMemberUpdate, AppRole } from '../shared/appAccess'

const discovery = new DiscoveryService()
const authService = new AuthService()
const appAccessService = new AppAccessService(authService)
type BoxTarget = { url: string; transport: 'lan' }

/**
 * Resolve the dummy desktop's device directly. An explicit AIOS_BOX_URL wins,
 * followed by the first mDNS-discovered box, then the local development URL.
 */
const resolveBoxTarget = async (): Promise<BoxTarget | null> => {
  const configured = process.env.AIOS_BOX_URL?.trim()
  if (configured) return { url: configured.replace(/\/$/, ''), transport: 'lan' }

  const discovered = discovery.list()[0]
  if (discovered) return { url: discovered.url.replace(/\/$/, ''), transport: 'lan' }

  return { url: SERVER_URL, transport: 'lan' }
}

// Box events (chat streams, notification pushes, etc.) flow out through this.
// Assigned once the window + native-notification helper exist (in whenReady).
let dispatchBoxEvent: (message: WSEnvelope) => void = () => {}

// HTTP/SSE replacement for the retired box WebSocket. Speaks the same envelope
// surface the renderer expects, but over the box's HTTP routes + `/message` SSE.
const boxClient = new BoxClient({
  resolveTarget: resolveBoxTarget,
  emit: (message) => dispatchBoxEvent(message)
})

/**
 * Begin talking directly to the box.
 */
const startBoxClient = (): void => {
  boxClient.start()
}

const commandErrorText = async (res: Response): Promise<string> => {
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`
}

/**
 * Send a command directly to the configured or discovered box.
 */
const deviceCommand = async (
  type: string,
  payload?: Record<string, unknown>
): Promise<CommandResult> => {
  const target = await resolveBoxTarget()
  if (target) {
    try {
      const res = await fetch(`${target.url}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload })
      })
      if (!res.ok) {
        // Cloudflare returns 502/503/530 when the tunnel origin (the box) is
        // down — surface that as a clean "offline" rather than a raw status.
        const offline = res.status >= 502
        return {
          ok: false,
          error: offline ? 'Device is offline' : await commandErrorText(res),
          transport: target.transport
        }
      }
      const data = (await res.json()) as { ok: boolean; result?: Record<string, unknown> | null }
      return { ok: data.ok, result: data.result ?? null, transport: target.transport }
    } catch {
      // Connection failed entirely — box isn't reachable on this path.
      return { ok: false, error: 'Device is offline', transport: target.transport }
    }
  }

  return { ok: false, error: 'Device is not reachable', transport: 'none' }
}

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
app.whenReady().then(async () => {
  let mainWindow: BrowserWindow | null = null

  await authService.load()
  discovery.start()

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

  ipcMain.handle('discovery:list', () => discovery.list())

  ipcMain.handle('auth:get-state', () => authService.getState())
  ipcMain.handle('auth:login', (_event, { email, password }: { email: string; password: string }) =>
    authService.loginWithPassword(email, password)
  )
  ipcMain.handle(
    'auth:signup',
    (_event, { email, password }: { email: string; password: string }) =>
      authService.signupWithPassword(email, password)
  )
  ipcMain.handle('auth:google', () => authService.loginWithGoogle())
  ipcMain.handle('auth:logout', () => authService.logout())

  ipcMain.handle('app-access:list', () => appAccessService.listApps())
  ipcMain.handle('app-access:overview', (_event, appId: string) =>
    appAccessService.getOverview(appId)
  )
  ipcMain.handle(
    'app-access:create-invitation',
    (_event, payload: { appId: string; email: string; role: Exclude<AppRole, 'owner'> }) =>
      appAccessService.createInvitation(payload.appId, payload.email, payload.role)
  )
  ipcMain.handle(
    'app-access:cancel-invitation',
    (_event, payload: { appId: string; invitationId: string }) =>
      appAccessService.cancelInvitation(payload.appId, payload.invitationId)
  )
  ipcMain.handle(
    'app-access:update-member',
    (_event, payload: { appId: string; appUserId: string; update: AppMemberUpdate }) =>
      appAccessService.updateMember(payload.appId, payload.appUserId, payload.update)
  )
  ipcMain.handle(
    'app-access:remove-member',
    (_event, payload: { appId: string; appUserId: string }) =>
      appAccessService.removeMember(payload.appId, payload.appUserId)
  )

  ipcMain.handle(
    'device:command',
    async (_event, { type, payload }: { type: string; payload?: Record<string, unknown> }) => {
      return deviceCommand(type, payload)
    }
  )

  ipcMain.on('overlay:set-ignore-mouse-events', (event, ignore: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win === mainWindow) return
    console.log('[overlay] set-ignore-mouse-events:', ignore)
    win.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.on('renderer:send-socket-message', (_event, envelope: WSEnvelope) => {
    void boxClient.send(envelope)
    console.log(`[renderer] Box message: ${envelope.type}`)
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

      const target = await resolveBoxTarget()
      if (!target) {
        throw new Error('Device is not reachable (not on this network and no tunnel).')
      }
      const response = await fetch(`${target.url}/attachments`, {
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

  // Fan a box event out to the renderer(s), and raise a native notification
  // when the box reports a new one.
  dispatchBoxEvent = (message: WSEnvelope): void => {
    if (is.dev) {
      console.log(`[box] event -> ${message.type}`)
    }

    if (message.type === 'notification.created') {
      showNativeNotification(message.data.title, message.data.body)
    }

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('main:socket-event', message)
    }
  }

  // Let LAN discovery settle so an at-home box is preferred over the tunnel.
  await discovery.waitForFirst(2_500)

  startBoxClient()
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
  boxClient.stop()
  discovery.stop()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
