import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  getChildWindowName,
  type ChildWindowRegistration,
  type ChildWindowUpdate
} from '@shared/window'

const MANAGED_STYLE_SELECTOR = 'style, link[rel="stylesheet"]'
const MANAGED_STYLE_ATTR = 'data-aios-child-window-style'

type ChildWindowProps = {
  registration: ChildWindowRegistration
  visible: boolean
  onClosed: () => void
  children: ReactNode
}

const syncWindowChrome = (
  sourceDocument: Document,
  targetDocument: Document,
  windowKey: string
): void => {
  targetDocument.documentElement.className = sourceDocument.documentElement.className
  targetDocument.documentElement.style.cssText = sourceDocument.documentElement.style.cssText
  targetDocument.documentElement.dataset.windowMode = windowKey
  targetDocument.body.dataset.windowMode = windowKey
  targetDocument.body.style.margin = '0'
  targetDocument.body.style.background = 'transparent'
  targetDocument.body.style.overflow = 'hidden'
}

const syncStyles = (sourceDocument: Document, targetDocument: Document): (() => void) => {
  const copyStyles = (): void => {
    targetDocument.head
      .querySelectorAll<HTMLElement>(`[${MANAGED_STYLE_ATTR}]`)
      .forEach((node) => node.remove())

    sourceDocument.head.querySelectorAll<HTMLElement>(MANAGED_STYLE_SELECTOR).forEach((node) => {
      const clone = node.cloneNode(true) as HTMLElement
      clone.setAttribute(MANAGED_STYLE_ATTR, 'true')
      targetDocument.head.appendChild(clone)
    })
  }

  copyStyles()

  const observer = new MutationObserver(() => {
    copyStyles()
  })

  observer.observe(sourceDocument.head, {
    childList: true,
    subtree: true,
    characterData: true
  })

  return () => {
    observer.disconnect()
    targetDocument.head
      .querySelectorAll<HTMLElement>(`[${MANAGED_STYLE_ATTR}]`)
      .forEach((node) => node.remove())
  }
}

const ChildWindow = ({ registration, visible, onClosed, children }: ChildWindowProps): ReactNode => {
  const childWindowRef = useRef<Window | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const isUnmountingRef = useRef(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let isCancelled = false

    const openChildWindow = async (): Promise<void> => {
      if (!visible) {
        return
      }

      const existingChildWindow = childWindowRef.current
      if (existingChildWindow && !existingChildWindow.closed) {
        return
      }

      await window.api.registerChildWindow(registration)
      if (isCancelled) {
        return
      }

      const nextWindow = window.open('', getChildWindowName(registration.windowKey), 'popup=yes')
      if (!nextWindow) {
        onClosed()
        return
      }

      childWindowRef.current = nextWindow
      nextWindow.document.title = registration.title
      syncWindowChrome(document, nextWindow.document, registration.windowKey)

      const removeManagedStyles = syncStyles(document, nextWindow.document)
      const portalRoot = nextWindow.document.createElement('div')
      portalRoot.id = `aios-child-window-root-${registration.windowKey}`
      nextWindow.document.body.replaceChildren(portalRoot)

      const handleChildClosed = (): void => {
        if (isUnmountingRef.current) {
          return
        }

        cleanupRef.current?.()
        cleanupRef.current = null
        childWindowRef.current = null
        setPortalContainer(null)
        onClosed()
      }

      nextWindow.addEventListener('beforeunload', handleChildClosed)
      nextWindow.addEventListener('pagehide', handleChildClosed)

      cleanupRef.current = () => {
        nextWindow.removeEventListener('beforeunload', handleChildClosed)
        nextWindow.removeEventListener('pagehide', handleChildClosed)
        removeManagedStyles()
      }

      setPortalContainer(portalRoot)
    }

    void openChildWindow()

    return () => {
      isCancelled = true
    }
  }, [onClosed, registration, visible])

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true
      cleanupRef.current?.()
      cleanupRef.current = null

      const childWindow = childWindowRef.current
      childWindowRef.current = null
      setPortalContainer(null)

      if (childWindow && !childWindow.closed) {
        childWindow.close()
      }

      isUnmountingRef.current = false
    }
  }, [])

  useEffect(() => {
    const childWindow = childWindowRef.current
    if (!childWindow || childWindow.closed) {
      return
    }

    childWindow.document.title = registration.title
    syncWindowChrome(document, childWindow.document, registration.windowKey)

    const update: ChildWindowUpdate = {
      windowKey: registration.windowKey,
      title: registration.title,
      options: registration.options
    }

    window.api.updateChildWindow(update)
  }, [registration])

  useEffect(() => {
    if (!portalContainer) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      if (visible) {
        window.api.showChildWindow(registration.windowKey)
        return
      }

      window.api.hideChildWindow(registration.windowKey)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [portalContainer, registration.windowKey, visible])

  if (!portalContainer) {
    return null
  }

  return createPortal(children, portalContainer)
}

export default ChildWindow
