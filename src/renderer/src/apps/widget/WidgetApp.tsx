import type { JSX } from 'react'
import SocketSyncProvider from '../../providers/SocketSyncProvider'
import WidgetAppShell from './WidgetAppShell'

const WidgetApp = (): JSX.Element => (
  <SocketSyncProvider>
    <WidgetAppShell />
  </SocketSyncProvider>
)

export default WidgetApp
