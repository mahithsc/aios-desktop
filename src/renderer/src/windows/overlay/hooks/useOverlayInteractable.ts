import { useCallback, useContext } from 'react'
import { ChildWindowContext } from '../../ChildWindowContext'

type OverlayInteractable = {
  onMouseEnter: () => void
  onMouseLeave: () => void
}

const useOverlayInteractable = (): OverlayInteractable => {
  const childWindow = useContext(ChildWindowContext)

  const setIgnore = useCallback(
    (ignore: boolean) => {
      ;(childWindow as typeof window | null)?.api.setIgnoreMouseEvents(ignore)
    },
    [childWindow]
  )

  const onMouseEnter = useCallback(() => setIgnore(false), [setIgnore])

  const onMouseLeave = useCallback(() => {
    setIgnore(true)
  }, [setIgnore])

  return { onMouseEnter, onMouseLeave }
}

export default useOverlayInteractable
