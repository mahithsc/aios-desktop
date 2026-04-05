import type { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import {
  MAIN_WINDOW_MODE,
  RENDERER_WINDOW_MODE_QUERY_KEY,
  type RendererWindowMode
} from '../../shared/window'

export const loadRendererWindow = (
  targetWindow: BrowserWindow,
  mode: RendererWindowMode = MAIN_WINDOW_MODE
): Promise<void> => {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const targetUrl = new URL(process.env['ELECTRON_RENDERER_URL'])

    if (mode !== MAIN_WINDOW_MODE) {
      targetUrl.searchParams.set(RENDERER_WINDOW_MODE_QUERY_KEY, mode)
    }

    return targetWindow.loadURL(targetUrl.toString())
  }

  return targetWindow.loadFile(join(__dirname, '../renderer/index.html'), {
    query: mode === MAIN_WINDOW_MODE ? {} : { [RENDERER_WINDOW_MODE_QUERY_KEY]: mode }
  })
}
