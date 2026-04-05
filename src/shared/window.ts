export const WIDGET_SHORTCUT = 'CommandOrControl+\\'

export const CHILD_WINDOW_NAME_PREFIX = 'aios-child-window:'
export const WIDGET_WINDOW_KEY = 'widget'

export type ChildWindowKey = typeof WIDGET_WINDOW_KEY

export interface ChildWindowBounds {
  width: number
  height: number
  x?: number
  y?: number
}

export interface ChildWindowOptions {
  bounds: ChildWindowBounds
  frame?: boolean
  transparent?: boolean
  backgroundColor?: string
  alwaysOnTop?: boolean
  alwaysOnTopLevel?: 'normal' | 'floating'
  visibleOnAllWorkspaces?: boolean
  visibleOnFullScreen?: boolean
  skipTaskbar?: boolean
  resizable?: boolean
  minimizable?: boolean
  maximizable?: boolean
  fullscreenable?: boolean
  movable?: boolean
  hasShadow?: boolean
  hiddenInMissionControl?: boolean
  acceptFirstMouse?: boolean
  type?: 'panel'
}

export interface ChildWindowRegistration {
  windowKey: string
  title: string
  options: ChildWindowOptions
}

export interface ChildWindowUpdate {
  windowKey: string
  title?: string
  options?: Partial<Omit<ChildWindowOptions, 'bounds'>> & {
    bounds?: Partial<ChildWindowBounds>
  }
}

export const WIDGET_WINDOW_WIDTH = 560
export const WIDGET_WINDOW_MIN_HEIGHT = 92
export const WIDGET_WINDOW_MAX_HEIGHT_RATIO = 0.9
export const WIDGET_WINDOW_TOP_OFFSET = 72

export const getChildWindowName = (windowKey: string): string =>
  `${CHILD_WINDOW_NAME_PREFIX}${windowKey}`

export const parseChildWindowName = (frameName: string): string | null =>
  frameName.startsWith(CHILD_WINDOW_NAME_PREFIX)
    ? frameName.slice(CHILD_WINDOW_NAME_PREFIX.length)
    : null

export const createWidgetWindowRegistration = (): ChildWindowRegistration => ({
  windowKey: WIDGET_WINDOW_KEY,
  title: 'Aios Widget',
  options: {
    bounds: {
      width: WIDGET_WINDOW_WIDTH,
      height: WIDGET_WINDOW_MIN_HEIGHT
    },
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    alwaysOnTopLevel: 'floating',
    visibleOnAllWorkspaces: true,
    visibleOnFullScreen: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: true,
    hasShadow: false,
    acceptFirstMouse: true,
    hiddenInMissionControl: true,
    type: 'panel'
  }
})
