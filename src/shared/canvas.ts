export type CanvasArtifactKind = 'image' | 'video' | 'file' | 'html'

export interface CanvasArtifact {
  version: 1
  kind: CanvasArtifactKind
  title?: string
  url?: string
  filePath?: string
  name?: string
  mimeType?: string
  thumbnailUrl?: string
  textPreview?: string
  sizeBytes?: number
}

export interface CanvasToolResult {
  ok: true
  type: 'canvas_artifact'
  artifact: CanvasArtifact
  message?: string
}

export interface ChatCanvasArtifact {
  chatId: string
  runId: string
  toolCallId: string
  createdAt: number
  artifact: CanvasArtifact
}
