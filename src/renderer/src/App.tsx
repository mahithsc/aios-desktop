import { useEffect, useState, type JSX } from 'react'
import MainWindow from '@renderer/windows/main/MainWindow'
import OverlayWindow from '@renderer/windows/overlay/OverlayWindow'
import AuthScreen from '@renderer/pages/auth/AuthScreen'
import PairingScreen from '@renderer/pages/pairing/PairingScreen'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { usePairingStore } from '@renderer/store/usePairingStore'
import SocketSyncProvider from './providers/SocketSyncProvider'

const Splash = (): JSX.Element => <div className="h-screen w-screen bg-background" />

// Dev-only: skip the auth + pairing gates and go straight to chat (`yarn dev`).
// Production builds keep the full auth/pairing flow. Flip to `false` to test the
// gates in dev, or set VITE_SKIP_AUTH=0.
const SKIP_AUTH = import.meta.env.DEV && import.meta.env.VITE_SKIP_AUTH !== '0'

const App = (): JSX.Element => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)

  const authStatus = useAuthStore((state) => state.status)
  const initAuth = useAuthStore((state) => state.init)
  const pairingStatus = usePairingStore((state) => state.status)
  const initPairing = usePairingStore((state) => state.init)

  useEffect(() => {
    if (!SKIP_AUTH) void initAuth()
  }, [initAuth])

  // Determine pairing state only once the user is authenticated.
  useEffect(() => {
    if (!SKIP_AUTH && authStatus === 'authenticated') {
      void initPairing()
    }
  }, [authStatus, initPairing])

  if (!SKIP_AUTH) {
    if (authStatus === 'loading') {
      return <Splash />
    }

    if (authStatus !== 'authenticated') {
      return <AuthScreen />
    }

    if (pairingStatus === 'unknown') {
      return <Splash />
    }

    if (pairingStatus !== 'paired') {
      return <PairingScreen />
    }
  }

  return (
    <SocketSyncProvider>
      <>
        <MainWindow isOverlayOpen={isOverlayOpen} onOpenOverlay={() => setIsOverlayOpen(true)} />
        <OverlayWindow isOpen={isOverlayOpen} onClose={() => setIsOverlayOpen(false)} />
      </>
    </SocketSyncProvider>
  )
}

export default App
