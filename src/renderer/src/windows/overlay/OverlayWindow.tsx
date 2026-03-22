import type { JSX } from 'react'
import ChildWindow from '../ChildWindow'
import DesktopWidget from './DesktopWidget'
import ClickableSonner from './components/ClickableSonner'

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
      <div className="h-full w-full pt-12 px-5">
        <ClickableSonner />
        <DesktopWidget />
      </div>
    </ChildWindow>
  )
}

export default OverlayWindow
