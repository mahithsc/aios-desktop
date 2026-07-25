import type { DiscoveredDevice } from '@shared/discovery'
import type { PairedDevice } from '@shared/pairing'
import { create } from 'zustand'

type PairingStatus = 'unknown' | 'paired' | 'unpaired'

interface PairingStore {
  status: PairingStatus
  device: PairedDevice | null
  discovered: DiscoveredDevice[]
  pairingDeviceId: string | null
  error: string | null
  init: () => Promise<void>
  refreshDiscovered: () => Promise<void>
  pair: (deviceId: string) => Promise<void>
  unpair: () => Promise<void>
}

export const usePairingStore = create<PairingStore>((set, get) => ({
  status: 'unknown',
  device: null,
  discovered: [],
  pairingDeviceId: null,
  error: null,

  init: async () => {
    const state = await window.api.pairing.getState()
    set({ status: state.device ? 'paired' : 'unpaired', device: state.device })
    if (!state.device) await get().refreshDiscovered()
  },

  refreshDiscovered: async () => {
    const devices = await window.api.listDevices()
    set({ discovered: devices })
  },

  pair: async (deviceId) => {
    set({ pairingDeviceId: deviceId, error: null })
    const result = await window.api.pairing.pair(deviceId)
    if (result.ok) {
      set({ status: 'paired', device: result.device, pairingDeviceId: null, error: null })
    } else {
      set({ pairingDeviceId: null, error: result.error })
    }
  },

  unpair: async () => {
    await window.api.pairing.unpair()
    set({ status: 'unpaired', device: null, error: null })
    await get().refreshDiscovered()
  }
}))
