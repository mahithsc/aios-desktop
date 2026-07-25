import { SERVER_URL } from '../../shared/config'
import type { DiscoveredDevice, DiscoveryService } from './DiscoveryService'

/** How long to wait for LAN discovery before falling back to the configured URL. */
const DISCOVERY_TIMEOUT_MS = 2_500

export interface ResolvedEndpoint {
  url: string
  source: 'lan' | 'fallback'
  device: DiscoveredDevice | null
}

/**
 * Local-first endpoint resolution: use a box discovered on the LAN if one
 * appears within the timeout, otherwise fall back to the configured
 * `SERVER_URL`. This replaces the previously hardcoded address.
 */
export async function resolveServerUrl(discovery: DiscoveryService): Promise<ResolvedEndpoint> {
  const device = await discovery.waitForFirst(DISCOVERY_TIMEOUT_MS)
  if (device) {
    return { url: device.url, source: 'lan', device }
  }
  return { url: SERVER_URL, source: 'fallback', device: null }
}
