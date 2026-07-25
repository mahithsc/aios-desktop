export interface DiscoveredDevice {
  deviceId: string
  name: string
  address: string
  port: number
  /** Base HTTP URL for the box, e.g. `http://192.168.68.65:8765`. */
  url: string
}
