import { useEffect, useState, type JSX } from 'react'
import MainWindow from '@renderer/windows/main/MainWindow'
import OverlayWindow from '@renderer/windows/overlay/OverlayWindow'
import AuthScreen from '@renderer/pages/auth/AuthScreen'
import { useAuthStore } from '@renderer/store/useAuthStore'
import SocketSyncProvider from './providers/SocketSyncProvider'

const Splash = (): JSX.Element => <div className="h-screen w-screen bg-background" />

// Explicit E2E opt-in, while development still skips the account gate by default.
const SKIP_AUTH =
  import.meta.env.VITE_SKIP_AUTH === '1' ||
  (import.meta.env.DEV && import.meta.env.VITE_SKIP_AUTH !== '0')

const App = (): JSX.Element => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)

  const authStatus = useAuthStore((state) => state.status)
  const initAuth = useAuthStore((state) => state.init)

  useEffect(() => {
    if (!SKIP_AUTH) void initAuth()
  }, [initAuth])

  if (!SKIP_AUTH) {
    if (authStatus === 'loading') {
      return <Splash />
    }

    if (authStatus !== 'authenticated') {
      return <AuthScreen />
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
