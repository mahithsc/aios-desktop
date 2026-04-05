import type { JSX } from 'react'
import SocketSyncProvider from './providers/SocketSyncProvider'
import WidgetWindow from './windows/widget/WidgetWindow'

const WidgetApp = (): JSX.Element => (
  <SocketSyncProvider>
    <WidgetWindow onRequestClose={() => window.api.hideWidgetWindow()} />
  </SocketSyncProvider>
)

export default WidgetApp
