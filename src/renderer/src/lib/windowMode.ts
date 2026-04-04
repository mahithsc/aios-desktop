import {
  DESKTOP_WINDOW_MODE,
  DESKTOP_WINDOW_MODE_QUERY_KEY,
  type DesktopWindowMode
} from '@shared/window'

export const getWindowMode = (): DesktopWindowMode => {
  const requestedMode = new URLSearchParams(window.location.search).get(
    DESKTOP_WINDOW_MODE_QUERY_KEY
  )

  return requestedMode === DESKTOP_WINDOW_MODE.widget
    ? DESKTOP_WINDOW_MODE.widget
    : DESKTOP_WINDOW_MODE.main
}

export const isWidgetWindow = (): boolean => getWindowMode() === DESKTOP_WINDOW_MODE.widget
