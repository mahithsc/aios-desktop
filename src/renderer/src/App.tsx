import type { JSX } from 'react'
import { DESKTOP_WINDOW_MODE } from '@shared/window'
import MainWindow from '@renderer/windows/main/MainWindow'
import WidgetWindow from '@renderer/windows/widget/WidgetWindow'
import SocketSyncProvider from './providers/SocketSyncProvider'
import { getWindowMode } from './lib/windowMode'

const App = (): JSX.Element => {
  const windowMode = getWindowMode()

  return (
    <SocketSyncProvider>
      {windowMode === DESKTOP_WINDOW_MODE.widget ? <WidgetWindow /> : <MainWindow />}
    </SocketSyncProvider>
  )
}

export default App
