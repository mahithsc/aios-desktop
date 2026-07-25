export interface PairedDevice {
  deviceId: string
  slug: string
  boxUrl: string
}

export interface PairState {
  device: PairedDevice | null
}

export type PairResult = { ok: true; device: PairedDevice } | { ok: false; error: string }
