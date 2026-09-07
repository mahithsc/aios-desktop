import { Bonjour } from 'bonjour-service'
import type { DiscoveredDevice } from '../../shared/discovery'

export type { DiscoveredDevice }

// bonjour-service exports `Browser`/`Service` as values only, so derive their
// instance types from the API surface rather than importing them.
type BonjourInstance = InstanceType<typeof Bonjour>
type BrowserHandle = ReturnType<BonjourInstance['find']>
type DiscoveredService = BrowserHandle['services'][number]

const AIOS_SERVICE_TYPE = 'aios'

const isIpv4 = (value: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(value)

const pickIpv4 = (addresses: string[] | undefined): string | null => {
  if (!addresses) return null
  return addresses.find(isIpv4) ?? null
}

/**
 * Discovers aios boxes on the local network via mDNS (`_aios._tcp`).
 *
 * The box advertises its stable `device_id` in the TXT record (see the box's
 * `server/discovery.py`), so we key direct LAN targets by physical device.
 */
export class DiscoveryService {
  private readonly bonjour = new Bonjour()
  private browser: BrowserHandle | null = null
  private readonly devices = new Map<string, DiscoveredDevice>()
  private readonly listeners = new Set<(devices: DiscoveredDevice[]) => void>()
  private readonly waiters = new Set<(device: DiscoveredDevice) => void>()

  start(): void {
    if (this.browser) return
    this.browser = this.bonjour.find({ type: AIOS_SERVICE_TYPE, protocol: 'tcp' })
    this.browser.on('up', (service) => this.handleUp(service))
    this.browser.on('down', (service) => this.handleDown(service))
  }

  list(): DiscoveredDevice[] {
    return [...this.devices.values()]
  }

  onChange(listener: (devices: DiscoveredDevice[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Resolve the first box seen. Returns immediately if one is already known,
   * otherwise waits up to `timeoutMs` for one to appear, then `null`.
   */
  waitForFirst(timeoutMs: number): Promise<DiscoveredDevice | null> {
    const existing = this.list()[0]
    if (existing) return Promise.resolve(existing)

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters.delete(onFound)
        resolve(null)
      }, timeoutMs)

      const onFound = (device: DiscoveredDevice): void => {
        clearTimeout(timer)
        this.waiters.delete(onFound)
        resolve(device)
      }

      this.waiters.add(onFound)
    })
  }

  stop(): void {
    this.browser?.stop()
    this.browser = null
    this.bonjour.destroy()
    this.devices.clear()
    this.listeners.clear()
    this.waiters.clear()
  }

  private handleUp(service: DiscoveredService): void {
    const deviceId = service.txt?.device_id
    const address = pickIpv4(service.addresses)
    if (!deviceId || !address || !service.port) {
      return
    }

    const device: DiscoveredDevice = {
      deviceId,
      name: service.txt?.name ?? service.name ?? deviceId,
      address,
      port: service.port,
      url: `http://${address}:${service.port}`
    }

    this.devices.set(deviceId, device)
    this.notify()
    for (const waiter of this.waiters) {
      waiter(device)
    }
  }

  private handleDown(service: DiscoveredService): void {
    const deviceId = service.txt?.device_id
    if (deviceId && this.devices.delete(deviceId)) {
      this.notify()
    }
  }

  private notify(): void {
    const snapshot = this.list()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
