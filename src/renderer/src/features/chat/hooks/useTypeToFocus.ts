import { useCallback, useEffect, useRef } from 'react'
import { useInputStore } from '../store/useInputStore'

type UseTypeToFocusOptions = {
  enabled?: boolean
  setValue: (value: string) => void
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  )
}

const shouldCaptureTyping = (event: globalThis.KeyboardEvent): boolean => {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return false
  }

  return event.key.length === 1
}

export const useTypeToFocus = ({
  enabled = true,
  setValue
}: UseTypeToFocusOptions): { handleFocusReady: (focus: () => void) => void } => {
  const focusRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleWindowKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (!shouldCaptureTyping(event) || isEditableTarget(event.target)) {
        return
      }

      event.preventDefault()
      focusRef.current?.()
      setValue(`${useInputStore.getState().value}${event.key}`)
    }

    window.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [enabled, setValue])

  const handleFocusReady = useCallback((focus: () => void): void => {
    focusRef.current = focus
  }, [])

  return { handleFocusReady }
}
