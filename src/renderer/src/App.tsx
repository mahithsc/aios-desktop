import { useEffect, useState, type JSX } from 'react'
import MainWindow from '@renderer/windows/main/MainWindow'
import WidgetPortal from '@renderer/windows/widget/WidgetPortal'
import SocketSyncProvider from './providers/SocketSyncProvider'

const App = (): JSX.Element => {
  const [isWidgetVisible, setIsWidgetVisible] = useState(false)

  useEffect(() => {
    return window.api.onToggleWidgetWindowRequested(() => {
      setIsWidgetVisible((current) => !current)
    })
  }, [])

  return (
    <SocketSyncProvider>
      <MainWindow />
      <WidgetPortal visible={isWidgetVisible} onClosed={() => setIsWidgetVisible(false)} />
    </SocketSyncProvider>
  )
}

export default App
