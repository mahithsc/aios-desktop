import type { JSX } from 'react'
import type { SocketConnectionState } from '../../../shared/store/socketStore'

type ConnectionStatusCardProps = {
  connectionState: SocketConnectionState
}

const getStatusLabel = (connectionState: SocketConnectionState): string => {
  if (connectionState === 'connected') return 'Connected'
  if (connectionState === 'connecting') return 'Connecting'
  if (connectionState === 'reconnecting') return 'Reconnecting'
  return 'Offline'
}

const getStatusDetail = (connectionState: SocketConnectionState): string => {
  if (connectionState === 'connected') return 'Live sync is active'
  if (connectionState === 'connecting') return 'Starting websocket'
  if (connectionState === 'reconnecting') return 'Restoring websocket'
  return 'Waiting for backend'
}

const getStatusClassName = (connectionState: SocketConnectionState): string => {
  if (connectionState === 'connected') return 'text-emerald-300'
  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    return 'text-amber-200'
  }

  return 'text-red-200'
}

const ConnectionStatusCard = ({
  connectionState
}: ConnectionStatusCardProps): JSX.Element => {
  return (
    <div className="h-40 w-40">
      <div className="h-full w-full rounded-[1.5rem] bg-card px-3.5 py-3.5 shadow-sm">
        <div className="flex h-full flex-col justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-medium text-muted-foreground">Connection status</div>
            <div
              className={`text-[1.65rem] font-light tracking-tight ${getStatusClassName(connectionState)}`}
            >
              {getStatusLabel(connectionState)}
            </div>
          </div>

          <div className="text-[12px] font-medium text-foreground/85">
            {getStatusDetail(connectionState)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConnectionStatusCard
