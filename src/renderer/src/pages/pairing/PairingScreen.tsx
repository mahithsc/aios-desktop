import { useEffect, type JSX } from 'react'
import { usePairingStore } from '@renderer/store/usePairingStore'

const DISCOVERY_POLL_MS = 2_000

const PairingScreen = (): JSX.Element => {
  const discovered = usePairingStore((state) => state.discovered)
  const pairingDeviceId = usePairingStore((state) => state.pairingDeviceId)
  const error = usePairingStore((state) => state.error)
  const refreshDiscovered = usePairingStore((state) => state.refreshDiscovered)
  const pair = usePairingStore((state) => state.pair)

  useEffect(() => {
    const id = window.setInterval(() => void refreshDiscovered(), DISCOVERY_POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshDiscovered])

  return (
    <div
      className="flex h-screen w-screen items-center justify-center bg-background text-foreground"
      data-testid="pair-screen"
    >
      <div className="w-[420px] rounded-2xl border border-border bg-card p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <h1 className="mb-1 text-xl font-semibold">Link a device</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Devices found on your network. Pair one to link it to your account.
        </p>

        {discovered.length === 0 ? (
          <div
            className="rounded-xl border border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground"
            data-testid="pair-empty"
          >
            Searching for devices on your network…
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {discovered.map((device) => {
              const busy = pairingDeviceId === device.deviceId
              return (
                <li
                  key={device.deviceId}
                  className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{device.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{device.url}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || pairingDeviceId !== null}
                    data-testid="pair-button"
                    onClick={() => void pair(device.deviceId)}
                    className="ml-3 shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Pairing…' : 'Pair'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {error ? (
          <p className="mt-4 px-1 text-sm text-destructive" data-testid="pair-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default PairingScreen
