import { useMemo, type ReactNode } from 'react'
import { createWidgetWindowRegistration } from '@shared/window'
import ChildWindow from '../ChildWindow'
import WidgetWindow from './WidgetWindow'

type WidgetPortalProps = {
  visible: boolean
  onClosed: () => void
}

const WidgetPortal = ({ visible, onClosed }: WidgetPortalProps): ReactNode => {
  const registration = useMemo(() => createWidgetWindowRegistration(), [])

  return (
    <ChildWindow registration={registration} visible={visible} onClosed={onClosed}>
      <WidgetWindow onRequestClose={onClosed} />
    </ChildWindow>
  )
}

export default WidgetPortal
