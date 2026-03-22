import { useEffect, type CSSProperties, type JSX, type ReactNode } from 'react'
import useOverlayInteractable from '../hooks/useOverlayInteractable'

type ClickableDivProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

const ClickableDiv = ({ children, className, style }: ClickableDivProps): JSX.Element => {
  const { onMouseEnter, onMouseLeave } = useOverlayInteractable()

  useEffect(() => {
    return () => {
      onMouseLeave()
    }
  }, [onMouseLeave])

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={className}
      style={style}
    >
      {children}
    </div>
  )
}

export default ClickableDiv
