import type { JSX } from 'react'
import MainWindow from '@renderer/windows/main/MainWindow'
import SocketSyncProvider from './providers/SocketSyncProvider'

const App = (): JSX.Element => (
  <SocketSyncProvider>
    <MainWindow />
  </SocketSyncProvider>
)

export default App
