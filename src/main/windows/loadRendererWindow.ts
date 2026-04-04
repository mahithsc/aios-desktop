import type { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { DESKTOP_WINDOW_MODE_QUERY_KEY, type DesktopWindowMode } from '../../shared/window'

export const loadRendererWindow = (
  targetWindow: BrowserWindow,
  windowMode: DesktopWindowMode
): void => {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    rendererUrl.searchParams.set(DESKTOP_WINDOW_MODE_QUERY_KEY, windowMode)
    void targetWindow.loadURL(rendererUrl.toString())
    return
  }

  void targetWindow.loadFile(join(__dirname, '../renderer/index.html'), {
    query: {
      [DESKTOP_WINDOW_MODE_QUERY_KEY]: windowMode
    }
  })
}
