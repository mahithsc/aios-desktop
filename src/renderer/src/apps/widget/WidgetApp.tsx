import type { JSX } from 'react'
import SocketSyncProvider from '../../providers/SocketSyncProvider'
import WidgetAppShell from './WidgetAppShell'

const WidgetApp = (): JSX.Element => (
  <SocketSyncProvider>
    <WidgetAppShell onRequestClose={() => window.api.hideWidgetWindow()} />
  </SocketSyncProvider>
)

export default WidgetApp
