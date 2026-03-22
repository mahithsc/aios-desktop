import { useEffect, useRef, type JSX } from 'react'
import { Toaster } from 'sonner'
import ClickableDiv from './ClickableDiv'
import useOverlayInteractable from '../hooks/useOverlayInteractable'

const ClickableSonner = (): JSX.Element => {
  const { onMouseLeave } = useOverlayInteractable()
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!wrapperRef.current) {
      return
    }

    const ownerDocument = wrapperRef.current.ownerDocument
    const hasActiveSonnerToasts = (): boolean =>
      ownerDocument.querySelector('[data-sonner-toast]') !== null

    const observer = new MutationObserver(() => {
      if (!hasActiveSonnerToasts()) {
        onMouseLeave()
      }
    })

    observer.observe(ownerDocument.body, {
      childList: true,
      subtree: true
    })

    return () => {
      observer.disconnect()
    }
  }, [onMouseLeave])

  return (
    <ClickableDiv>
      <div ref={wrapperRef}>
        <Toaster position="top-right" offset={{ top: 45 }} richColors theme="dark" />
      </div>
    </ClickableDiv>
  )
}

export default ClickableSonner
