import { app, safeStorage } from 'electron'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { CLOUD_URL } from '../../shared/config'
import type { PairResult, PairState, PairedDevice } from '../../shared/pairing'
import type { AuthService } from './AuthService'
import type { DiscoveryService } from './DiscoveryService'

interface StoredPairing extends PairedDevice {
  /** Shared secret for direct LAN calls to the box (Phase 3). Kept in main. */
  localToken: string
}

const cloudUrl = (): string => process.env.AIOS_CLOUD_URL ?? CLOUD_URL

const useEncryption = (): boolean => {
  if (process.env.AIOS_AUTH_INSECURE_STORE === '1') return false
  return safeStorage.isEncryptionAvailable()
}

const extractError = async (res: Response, fallback: string): Promise<string> => {
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
  } catch {
    // ignore
  }
  return `${fallback} (${res.status})`
}

/**
 * Orchestrates the cloud-vouched pairing handshake from the desktop side:
 * ask the cloud for a pairing code (as the logged-in user), hand it to the box
 * over the LAN, and persist the resulting binding + local token.
 */
export class PairingService {
  private pairing: StoredPairing | null = null

  constructor(
    private readonly auth: AuthService,
    private readonly discovery: DiscoveryService
  ) {}

  private get filePath(): string {
    return join(app.getPath('userData'), 'aios-pairing.bin')
  }

  async load(): Promise<void> {
    try {
      const buffer = await readFile(this.filePath)
      const json = useEncryption() ? safeStorage.decryptString(buffer) : buffer.toString('utf8')
      this.pairing = JSON.parse(json) as StoredPairing
    } catch {
      this.pairing = null
    }
  }

  getState(): PairState {
    return { device: this.toPublic(this.pairing) }
  }

  getLocalToken(): string | null {
    return this.pairing?.localToken ?? null
  }

  async pair(deviceId: string): Promise<PairResult> {
    const discovered = this.discovery.list().find((d) => d.deviceId === deviceId)
    if (!discovered) {
      return { ok: false, error: 'Device is no longer visible on the network.' }
    }

    const accessToken = this.auth.getAccessToken()
    if (!accessToken) {
      return { ok: false, error: 'You must be signed in to pair a device.' }
    }

    // 1. Ask the cloud for a pairing code (authenticated as the user).
    let code: string
    try {
      const res = await fetch(`${cloudUrl()}/device/claim/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ device_id: deviceId })
      })
      if (!res.ok) return { ok: false, error: await extractError(res, 'Could not start pairing') }
      code = ((await res.json()) as { pairing_code: string }).pairing_code
    } catch {
      return { ok: false, error: 'Cannot reach the aios-cloud service.' }
    }

    // 2. Hand the code to the box over the LAN; it redeems it with the cloud.
    let slug: string
    try {
      const res = await fetch(`${discovered.url}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairing_code: code })
      })
      if (!res.ok) return { ok: false, error: await extractError(res, 'The device rejected pairing') }
      const body = (await res.json()) as { slug: string; local_token: string }
      slug = body.slug
      this.pairing = {
        deviceId,
        slug: body.slug,
        boxUrl: discovered.url,
        localToken: body.local_token
      }
    } catch {
      return { ok: false, error: 'Could not reach the device on the network.' }
    }

    await this.persist()
    return { ok: true, device: { deviceId, slug, boxUrl: discovered.url } }
  }

  /**
   * Unpair: revoke in the cloud registry, tell the box to forget its binding
   * (best-effort over the LAN), and clear local state. Always clears locally so
   * the user is never stuck paired, even if the cloud/box calls fail.
   */
  async unpair(): Promise<{ ok: true }> {
    const paired = this.pairing
    if (!paired) return { ok: true }

    const accessToken = this.auth.getAccessToken()
    if (accessToken) {
      try {
        await fetch(`${cloudUrl()}/device/${paired.deviceId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      } catch {
        // best-effort; local clear below still unpairs the app
      }
    }

    const onLan = this.discovery.list().find((d) => d.deviceId === paired.deviceId)
    const boxUrl = onLan?.url ?? paired.boxUrl
    try {
      await fetch(`${boxUrl}/unpair`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${paired.localToken}` }
      })
    } catch {
      // box may be off-LAN/offline; cloud revoke already cut its access
    }

    this.pairing = null
    await this.persist()
    return { ok: true }
  }

  private toPublic(pairing: StoredPairing | null): PairedDevice | null {
    if (!pairing) return null
    return { deviceId: pairing.deviceId, slug: pairing.slug, boxUrl: pairing.boxUrl }
  }

  private async persist(): Promise<void> {
    if (!this.pairing) {
      await rm(this.filePath, { force: true })
      return
    }
    const json = JSON.stringify(this.pairing)
    const data = useEncryption() ? safeStorage.encryptString(json) : Buffer.from(json, 'utf8')
    await writeFile(this.filePath, data)
  }
}
