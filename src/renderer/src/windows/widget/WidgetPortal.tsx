import { useMemo, type ReactNode } from 'react'
import { createWidgetWindowRegistration } from '@shared/window'
import ChildWindow from '../ChildWindow'
import WidgetWindow from './WidgetWindow'

type WidgetPortalProps = {
  onClosed: () => void
}

const WidgetPortal = ({ onClosed }: WidgetPortalProps): ReactNode => {
  const registration = useMemo(() => createWidgetWindowRegistration(), [])

  return (
    <ChildWindow registration={registration} onClosed={onClosed}>
      <WidgetWindow onRequestClose={onClosed} />
    </ChildWindow>
  )
}

export default WidgetPortal
