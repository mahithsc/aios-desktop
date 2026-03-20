import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChildWindowContext } from './ChildWindowContext'

export type ChildWindowFeatures = {
  width?: number
  height?: number
  top?: number
  left?: number
  resizable?: boolean
  minimizable?: boolean
  maximizable?: boolean
  closable?: boolean
}

type ChildWindowProps = {
  children: ReactNode
  title: string
  features?: ChildWindowFeatures
  fitContentHeight?: boolean
  onClose?: () => void
}

const DEFAULT_WINDOW_FEATURES: Required<
  Pick<ChildWindowFeatures, 'width' | 'height' | 'resizable' | 'minimizable' | 'maximizable' | 'closable'>
> = {
  width: 1080,
  height: 760,
  resizable: true,
  minimizable: true,
  maximizable: true,
  closable: true
}

const PORTAL_STYLE_MARKER = 'data-child-window-style'

const buildWindowFeatures = (features?: ChildWindowFeatures): string => {
  const mergedFeatures = {
    ...DEFAULT_WINDOW_FEATURES,
    ...features
  }

  return Object.entries(mergedFeatures)
    .map(([key, value]) => `${key}=${typeof value === 'boolean' ? (value ? 'yes' : 'no') : value}`)
    .join(',')
}

const syncStyles = (sourceDocument: Document, targetDocument: Document): void => {
  targetDocument.head.querySelectorAll(`[${PORTAL_STYLE_MARKER}]`).forEach((node) => node.remove())

  sourceDocument.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    const clonedNode = node.cloneNode(true) as HTMLElement
    clonedNode.setAttribute(PORTAL_STYLE_MARKER, 'true')
    targetDocument.head.appendChild(clonedNode)
  })
}

const ChildWindow = ({
  children,
  title,
  features,
  fitContentHeight = false,
  onClose
}: ChildWindowProps): ReactNode => {
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(null)
  const [childWindow, setChildWindow] = useState<Window | null>(null)
  const childWindowRef = useRef<Window | null>(null)
  const onCloseRef = useRef(onClose)
  const windowFeatures = useMemo(() => buildWindowFeatures(features), [features])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const childWindow = window.open('about:blank', '_blank', windowFeatures)

    if (!childWindow) {
      onCloseRef.current?.()
      return
    }

    childWindowRef.current = childWindow
    childWindow.document.title = title
    childWindow.document.documentElement.lang = document.documentElement.lang
    childWindow.document.documentElement.className = document.documentElement.className
    childWindow.document.body.className = document.body.className
    childWindow.document.body.style.margin = '0'
    childWindow.document.body.style.background = 'transparent'

    const portalRoot = childWindow.document.createElement('div')
    portalRoot.dataset.childWindowRoot = 'true'
    portalRoot.style.width = '100%'
    childWindow.document.body.appendChild(portalRoot)

    syncStyles(document, childWindow.document)

    const styleObserver = new MutationObserver(() => {
      syncStyles(document, childWindow.document)
    })

    styleObserver.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true
    })

    const syncWindowSize = (): void => {
      if (!fitContentHeight || childWindow.closed) {
        return
      }

      const widthDelta = childWindow.outerWidth - childWindow.innerWidth
      const heightDelta = childWindow.outerHeight - childWindow.innerHeight
      const nextInnerWidth = Math.max(features?.width ?? 0, Math.ceil(portalRoot.scrollWidth))
      const nextInnerHeight = Math.max(features?.height ?? 0, Math.ceil(portalRoot.scrollHeight))

      childWindow.resizeTo(nextInnerWidth + widthDelta, nextInnerHeight + heightDelta)
    }

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(syncWindowSize)
    })

    if (fitContentHeight) {
      resizeObserver.observe(portalRoot)
    }

    const handleBeforeUnload = (): void => {
      if (childWindowRef.current !== childWindow) {
        return
      }

      childWindowRef.current = null
      setChildWindow(null)
      setContainerElement(null)
      onCloseRef.current?.()
    }

    childWindow.addEventListener('beforeunload', handleBeforeUnload)
    childWindow.focus()

    const animationFrameId = window.requestAnimationFrame(() => {
      setChildWindow(childWindow)
      setContainerElement(portalRoot)
      syncWindowSize()
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      styleObserver.disconnect()
      childWindow.removeEventListener('beforeunload', handleBeforeUnload)

      if (!childWindow.closed) {
        childWindow.close()
      }

      if (childWindowRef.current === childWindow) {
        childWindowRef.current = null
      }
    }
  }, [features?.height, features?.width, fitContentHeight, title, windowFeatures])

  useEffect(() => {
    if (childWindowRef.current) {
      childWindowRef.current.document.title = title
    }
  }, [title])

  return containerElement
    ? createPortal(
        <ChildWindowContext.Provider value={childWindow}>{children}</ChildWindowContext.Provider>,
        containerElement
      )
    : null
}

export default ChildWindow
