import { useState, type JSX } from 'react'
import MainWindow from '@renderer/windows/main/MainWindow'
import OverlayWindow from '@renderer/windows/overlay/OverlayWindow'
import SocketSyncProvider from './providers/SocketSyncProvider'

const App = (): JSX.Element => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)

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
