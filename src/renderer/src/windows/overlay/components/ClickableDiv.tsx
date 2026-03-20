import type { JSX, ReactNode } from 'react'
import useOverlayInteractable from '../hooks/useOverlayInteractable'

type ClickableDivProps = {
  children: ReactNode
  className?: string
}

const ClickableDiv = ({ children, className }: ClickableDivProps): JSX.Element => {
  const { onMouseEnter, onMouseLeave } = useOverlayInteractable()

  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} className={className}>
      {children}
    </div>
  )
}

export default ClickableDiv
