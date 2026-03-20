import type { CSSProperties, JSX } from 'react'
import ChildWindow from '../ChildWindow'
import DesktopWidget from './DesktopWidget'

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

type OverlayWindowProps = {
  isOpen: boolean
  onClose: () => void
}

const OverlayWindow = ({ isOpen, onClose }: OverlayWindowProps): JSX.Element | null => {
  if (!isOpen) {
    return null
  }

  return (
    <ChildWindow
      title="AIOS Desktop Widget"
      features={{
        resizable: false,
        minimizable: false,
        maximizable: false
      }}
      onClose={onClose}
    >
      <div className="h-full w-full pt-12">
        <DesktopWidget dragRegionStyle={dragRegionStyle} noDragRegionStyle={noDragRegionStyle} />
      </div>
    </ChildWindow>
  )
}

export default OverlayWindow
