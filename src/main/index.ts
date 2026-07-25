import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SocketService } from './services/SocketService'
import { DiscoveryService } from './services/DiscoveryService'
import { AuthService } from './services/AuthService'
import { PairingService } from './services/PairingService'
import { createMainWindow } from './windows/createMainWindow'
import { CLOUD_URL } from '../shared/config'
import type { MessageAttachment } from '../shared/chat'
import type { WSEnvelope } from '../shared/ws'
import type { CommandResult } from '../shared/device'

const socketService = new SocketService((attempt) => Math.min(1_000 * 2 ** (attempt - 1), 10_000))
const discovery = new DiscoveryService()
const authService = new AuthService()
const pairingService = new PairingService(authService, discovery)

const cloudBaseUrl = (): string => process.env.AIOS_CLOUD_URL ?? CLOUD_URL

// Bypasses ngrok's free-tier browser interstitial for programmatic requests.
const BOX_HEADERS = { 'ngrok-skip-browser-warning': 'true' } as const

/**
 * Look up the paired box's public URL from the cloud registry: its Cloudflare
 * Tunnel subdomain (`hostname`) if provisioned, else a legacy `public_url`.
 */
const fetchRemoteUrl = async (deviceId: string): Promise<string | null> => {
  const accessToken = authService.getAccessToken()
  if (!accessToken) return null
  try {
    const res = await fetch(`${cloudBaseUrl()}/devices`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) return null
    const devices = (await res.json()) as Array<{
      device_id: string
      hostname?: string | null
      public_url?: string | null
    }>
    const device = devices.find((d) => d.device_id === deviceId)
    if (device?.hostname) return `https://${device.hostname}`
    return device?.public_url ?? null
  } catch {
    return null
  }
}

type BoxTarget = { url: string; transport: 'lan' | 'remote' }

/**
 * Resolve how to reach the paired box, local-first: its LAN address if it's
 * discoverable (mDNS), otherwise its public tunnel URL from the cloud registry
 * (works off-LAN).
 */
const resolveBoxTarget = async (): Promise<BoxTarget | null> => {
  const paired = pairingService.getState().device
  if (!paired) return null
  const onLan = discovery.list().find((d) => d.deviceId === paired.deviceId)
  if (onLan) return { url: onLan.url, transport: 'lan' }
  const remoteUrl = await fetchRemoteUrl(paired.deviceId)
  if (remoteUrl) return { url: remoteUrl, transport: 'remote' }
  return null
}

/**
 * (Re)connect the box WebSocket with the pairing `local_token`, using the LAN
 * or public tunnel URL. No-ops when unpaired or when the box is unreachable.
 */
const connectBoxSocket = async (): Promise<void> => {
  const token = pairingService.getLocalToken()
  if (!token) return
  const target = await resolveBoxTarget()
  if (!target) return
  const wsBase = target.url.replace(/^http/, 'ws')
  socketService.connect(`${wsBase}/ws?token=${encodeURIComponent(token)}`)
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
 * Send a command to the paired box, **local-first**: LAN when discoverable,
 * else the box's public tunnel URL, else the cloud relay as a last resort. The
 * chosen path is reported as `transport`.
 */
const deviceCommand = async (
  type: string,
  payload?: Record<string, unknown>
): Promise<CommandResult> => {
  const paired = pairingService.getState().device
  if (!paired) return { ok: false, error: 'No paired device', transport: 'none' }

  const target = await resolveBoxTarget()
  if (target) {
    const token = pairingService.getLocalToken()
    try {
      const res = await fetch(`${target.url}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...BOX_HEADERS,
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ type, payload })
      })
      if (!res.ok)
        return { ok: false, error: await commandErrorText(res), transport: target.transport }
      const data = (await res.json()) as { ok: boolean; result?: Record<string, unknown> | null }
      return { ok: data.ok, result: data.result ?? null, transport: target.transport }
    } catch {
      return { ok: false, error: `Could not reach the device (${target.transport})`, transport: target.transport }
    }
  }

  // Last resort: relay the command through the cloud.
  const accessToken = authService.getAccessToken()
  if (!accessToken) return { ok: false, error: 'Not signed in', transport: 'relay' }
  try {
    const res = await fetch(`${cloudBaseUrl()}/device/${paired.deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ type, payload })
    })
    if (!res.ok) return { ok: false, error: await commandErrorText(res), transport: 'relay' }
    const data = (await res.json()) as { ok: boolean; result?: Record<string, unknown> | null }
    return { ok: data.ok, result: data.result ?? null, transport: 'relay' }
  } catch {
    return { ok: false, error: 'Could not reach the cloud relay', transport: 'relay' }
  }
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
  await pairingService.load()
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

  ipcMain.handle('pair:get-state', () => pairingService.getState())
  ipcMain.handle('pair:device', async (_event, { deviceId }: { deviceId: string }) => {
    await authService.ensureFreshToken()
    const result = await pairingService.pair(deviceId)
    if (result.ok) {
      // Now that we hold a local_token, connect the box socket (it's rejected
      // while unpaired).
      await connectBoxSocket()
    }
    return result
  })

  ipcMain.handle('pair:unpair', async () => {
    await authService.ensureFreshToken()
    const result = await pairingService.unpair()
    // Drop the box chat socket; the app returns to the pairing screen.
    socketService.disconnect()
    return result
  })

  ipcMain.handle(
    'device:command',
    async (_event, { type, payload }: { type: string; payload?: Record<string, unknown> }) => {
      await authService.ensureFreshToken()
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

      const target = await resolveBoxTarget()
      if (!target) {
        throw new Error('Device is not reachable (not on this network and no tunnel).')
      }
      const localToken = pairingService.getLocalToken()
      const response = await fetch(`${target.url}/attachments`, {
        method: 'POST',
        headers: {
          ...BOX_HEADERS,
          ...(localToken ? { Authorization: `Bearer ${localToken}` } : {})
        },
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

  // Let LAN discovery settle so an at-home box is preferred over the tunnel.
  await discovery.waitForFirst(2_500)

  // Only connects if already paired; otherwise we connect right after pairing.
  await connectBoxSocket()
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
  discovery.stop()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
