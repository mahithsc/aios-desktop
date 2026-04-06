import type { JSX } from 'react'
import SocketSyncProvider from '../../providers/SocketSyncProvider'
import MainAppShell from './MainAppShell'

const MainApp = (): JSX.Element => (
  <SocketSyncProvider>
    <MainAppShell />
  </SocketSyncProvider>
)

export default MainApp
