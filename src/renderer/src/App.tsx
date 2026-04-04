import { useEffect, useState, type JSX } from 'react'
import MainWindow from '@renderer/windows/main/MainWindow'
import WidgetPortal from '@renderer/windows/widget/WidgetPortal'
import SocketSyncProvider from './providers/SocketSyncProvider'

const App = (): JSX.Element => {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false)

  useEffect(() => {
    return window.api.onToggleWidgetWindowRequested(() => {
      setIsWidgetOpen((current) => !current)
    })
  }, [])

  return (
    <SocketSyncProvider>
      <MainWindow />
      {isWidgetOpen ? <WidgetPortal onClosed={() => setIsWidgetOpen(false)} /> : null}
    </SocketSyncProvider>
  )
}

export default App
