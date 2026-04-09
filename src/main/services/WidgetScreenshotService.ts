import { BrowserWindow, desktopCapturer, screen, systemPreferences } from 'electron'
import type { MessageAttachment } from '../../shared/chat'
import { uploadAttachments } from './AttachmentUploadService'

const getCaptureDisplay = (widgetWindow: BrowserWindow | null): Electron.Display => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    return screen.getDisplayMatching(widgetWindow.getBounds())
  }

  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

const ensureScreenCapturePermission = (): void => {
  if (process.platform !== 'darwin') {
    return
  }

  const permissionStatus = systemPreferences.getMediaAccessStatus('screen')
  if (permissionStatus === 'granted') {
    return
  }

  throw new Error(
    permissionStatus === 'denied'
      ? 'Screen recording permission is denied for Aios. Enable it in macOS System Settings > Privacy & Security > Screen Recording.'
      : 'Screen recording permission is required before the widget can capture desktop screenshots.'
  )
}

const getSourceForDisplay = async (
  display: Electron.Display
): Promise<Electron.DesktopCapturerSource> => {
  const sourceSize = {
    width: Math.max(1, Math.round(display.bounds.width * display.scaleFactor)),
    height: Math.max(1, Math.round(display.bounds.height * display.scaleFactor))
  }
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: sourceSize
  })
  const displayId = String(display.id)
  const matchingSource = sources.find((source) => source.display_id === displayId)

  if (matchingSource) {
    return matchingSource
  }

  if (sources.length === 1) {
    return sources[0]
  }

  throw new Error(`Unable to find a screen capture source for display ${displayId}.`)
}

const buildScreenshotFilename = (): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `desktop-screenshot-${timestamp}.png`
}

export const captureWidgetScreenshotAttachment = async ({
  chatId,
  widgetWindow
}: {
  chatId: string
  widgetWindow: BrowserWindow | null
}): Promise<MessageAttachment> => {
  ensureScreenCapturePermission()
  const display = getCaptureDisplay(widgetWindow)
  const source = await getSourceForDisplay(display)
  const screenshotBytes = source.thumbnail.toPNG()

  if (screenshotBytes.byteLength === 0) {
    throw new Error('Desktop screenshot capture returned an empty image.')
  }

  const uploadedAttachments = await uploadAttachments(chatId, [
    {
      name: buildScreenshotFilename(),
      type: 'image/png',
      bytes: screenshotBytes
    }
  ])
  const [screenshotAttachment] = uploadedAttachments

  if (!screenshotAttachment) {
    throw new Error('Desktop screenshot upload did not return an attachment.')
  }

  return screenshotAttachment
}
