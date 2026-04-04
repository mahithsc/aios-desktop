export const DESKTOP_WINDOW_MODE_QUERY_KEY = 'window'

export const DESKTOP_WINDOW_MODE = {
  main: 'main',
  widget: 'widget'
} as const

export type DesktopWindowMode = (typeof DESKTOP_WINDOW_MODE)[keyof typeof DESKTOP_WINDOW_MODE]

export const WIDGET_SHORTCUT = 'CommandOrControl+\\'

export const WIDGET_WINDOW_WIDTH = 720
export const WIDGET_WINDOW_HEIGHT = 520
export const WIDGET_WINDOW_TOP_OFFSET = 72
