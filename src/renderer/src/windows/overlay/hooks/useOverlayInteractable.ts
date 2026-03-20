import { useContext } from 'react'
import { ChildWindowContext } from '../../ChildWindowContext'

const useOverlayInteractable = () => {
  const childWindow = useContext(ChildWindowContext)

  const onMouseEnter = (): void => {
    ;(childWindow as typeof window | null)?.api.setIgnoreMouseEvents(false)
  }

  const onMouseLeave = (): void => {
    ;(childWindow as typeof window | null)?.api.setIgnoreMouseEvents(true)
  }

  return { onMouseEnter, onMouseLeave }
}

export default useOverlayInteractable
