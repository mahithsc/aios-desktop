export const WIDGET_SHORTCUT = 'CommandOrControl+\\'

export const MAIN_WINDOW_MODE = 'main'
export const WIDGET_WINDOW_MODE = 'widget'

export type RendererWindowMode = typeof MAIN_WINDOW_MODE | typeof WIDGET_WINDOW_MODE

export const RENDERER_WINDOW_MODE_QUERY_KEY = 'window'

export const WIDGET_WINDOW_WIDTH = 520
export const WIDGET_WINDOW_MIN_HEIGHT = 92
export const WIDGET_WINDOW_MAX_HEIGHT_RATIO = 0.93
export const WIDGET_WINDOW_LEFT_OFFSET = 10
export const WIDGET_WINDOW_TOP_DRAG_BOUND = 16
export const WIDGET_WINDOW_TOP_OFFSET = WIDGET_WINDOW_TOP_DRAG_BOUND
