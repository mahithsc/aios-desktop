import type { CanvasArtifact, ChatCanvasArtifact } from '@shared/canvas'
import { useEffect, type JSX } from 'react'
import { SERVER_URL } from '@shared/config'
import Markdown from './Markdown'

type CanvasPanelProps = {
  artifact?: ChatCanvasArtifact
  width?: number
}

const deriveServedUrl = (artifact: CanvasArtifact): string | null => {
  const filePath = artifact.filePath?.trim()
  if (!filePath) {
    return null
  }

  const normalizedPath = filePath.replace(/\\/g, '/')
  const sessionArtifactsMatch = normalizedPath.match(/\/workspace\/session\/([^/]+)\/artifacts\/(.+)$/)
  if (sessionArtifactsMatch) {
    const [, chatId, artifactRelativePath] = sessionArtifactsMatch
    return `${SERVER_URL}/session-artifacts/${encodeURIComponent(chatId)}/${artifactRelativePath
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`
  }

  return null
}

const formatBytes = (sizeBytes?: number): string | null => {
  if (typeof sizeBytes !== 'number' || Number.isNaN(sizeBytes) || sizeBytes < 0) {
    return null
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = sizeBytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

const toCanvasSource = (artifact: CanvasArtifact): string | null => {
  if (artifact.url) {
    return artifact.url
  }

  const servedUrl = deriveServedUrl(artifact)
  if (servedUrl) {
    return servedUrl
  }

  if (!artifact.filePath) {
    return null
  }

  return `file://${encodeURI(artifact.filePath)}`
}

const isMarkdownArtifact = (artifact: CanvasArtifact): boolean => {
  const mimeType = artifact.mimeType?.toLowerCase()
  const name = artifact.name?.toLowerCase()
  const filePath = artifact.filePath?.toLowerCase()

  return (
    mimeType === 'text/markdown' ||
    mimeType === 'text/x-markdown' ||
    name?.endsWith('.md') === true ||
    name?.endsWith('.markdown') === true ||
    filePath?.endsWith('.md') === true ||
    filePath?.endsWith('.markdown') === true
  )
}

const isHtmlArtifact = (artifact: CanvasArtifact): boolean => {
  const mimeType = artifact.mimeType?.toLowerCase()
  const name = artifact.name?.toLowerCase()
  const filePath = artifact.filePath?.toLowerCase()
  const url = artifact.url?.toLowerCase()

  return (
    artifact.kind === 'html' ||
    mimeType === 'text/html' ||
    name?.endsWith('.html') === true ||
    filePath?.endsWith('.html') === true ||
    url?.endsWith('.html') === true
  )
}

const isTextArtifact = (artifact: CanvasArtifact): boolean =>
  artifact.mimeType?.toLowerCase().startsWith('text/') === true

const getArtifactLabel = (artifact: CanvasArtifact): string =>
  artifact.title || artifact.name || artifact.filePath || artifact.url || 'Canvas artifact'

const ArtifactMetadata = ({ artifact }: { artifact: CanvasArtifact }): JSX.Element => {
  const size = formatBytes(artifact.sizeBytes)

  return (
    <div className="space-y-1 text-xs text-stone-500">
      {artifact.mimeType ? <div>{artifact.mimeType}</div> : null}
      {size ? <div>{size}</div> : null}
      {artifact.url ? (
        <a
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all rounded-md bg-stone-100 px-2 py-1 font-mono text-[11px] text-stone-600 underline"
        >
          {artifact.url}
        </a>
      ) : null}
      {artifact.filePath ? (
        <div className="break-all rounded-md bg-stone-100 px-2 py-1 font-mono text-[11px] text-stone-600">
          {artifact.filePath}
        </div>
      ) : null}
    </div>
  )
}

const EmptyCanvasState = (): JSX.Element => (
  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 text-center text-sm text-stone-500">
    Canvas artifacts will appear here.
  </div>
)

const UnsupportedArtifact = ({ artifact }: { artifact: CanvasArtifact }): JSX.Element => {
  const source = toCanvasSource(artifact)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-stone-900">{getArtifactLabel(artifact)}</h3>
        <p className="mt-1 text-sm text-stone-500">
          This file type does not have an inline preview yet.
        </p>
      </div>
      <ArtifactMetadata artifact={artifact} />
      {source ? (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700 transition hover:bg-stone-50"
        >
          Open file
        </a>
      ) : null}
    </div>
  )
}

const CanvasArtifactView = ({ artifact }: { artifact: CanvasArtifact }): JSX.Element => {
  const source = toCanvasSource(artifact)
  const hasTextPreview = Boolean(artifact.textPreview?.trim())

  if (isHtmlArtifact(artifact) && source) {
    return (
      <div className="h-full w-full">
        <iframe
          src={source}
          title={artifact.title || artifact.name || 'Canvas preview'}
          className="h-full w-full border-0 bg-white"
        />
      </div>
    )
  }

  if (artifact.kind === 'image' && source) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-stone-900">{getArtifactLabel(artifact)}</h3>
        </div>
        <img
          src={source}
          alt={artifact.title || artifact.name || 'Canvas image'}
          className="max-h-112 w-full rounded-xl border border-stone-200 bg-stone-50 object-contain"
        />
        <ArtifactMetadata artifact={artifact} />
      </div>
    )
  }

  if (artifact.kind === 'video' && source) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-stone-900">{getArtifactLabel(artifact)}</h3>
        </div>
        <video
          src={source}
          controls
          className="max-h-112 w-full rounded-xl border border-stone-200 bg-black"
        />
        <ArtifactMetadata artifact={artifact} />
      </div>
    )
  }

  if (artifact.kind === 'file' && hasTextPreview && isMarkdownArtifact(artifact)) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-stone-900">{getArtifactLabel(artifact)}</h3>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <Markdown>{artifact.textPreview ?? ''}</Markdown>
        </div>
        <ArtifactMetadata artifact={artifact} />
      </div>
    )
  }

  if (artifact.kind === 'file' && hasTextPreview && isTextArtifact(artifact)) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-stone-900">{getArtifactLabel(artifact)}</h3>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs leading-5 text-stone-800">
          {artifact.textPreview}
        </pre>
        <ArtifactMetadata artifact={artifact} />
      </div>
    )
  }

  return <UnsupportedArtifact artifact={artifact} />
}

const CanvasPanel = ({ artifact, width = 480 }: CanvasPanelProps): JSX.Element => {
  useEffect(() => {
    console.debug('[canvas]', 'CanvasPanel rendered with artifact.', {
      artifact
    })
    window.api.logToConsole('debug', '[canvas] CanvasPanel rendered with artifact.', {
      artifact
    })
  }, [artifact])

  if (artifact && isHtmlArtifact(artifact.artifact)) {
    return (
      <aside
        className="min-w-0 shrink-0 overflow-hidden border-l border-stone-200 bg-white"
        style={{ width }}
      >
        <div className="h-full w-full">{artifact ? <CanvasArtifactView artifact={artifact.artifact} /> : null}</div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-4 py-3 text-sm font-medium text-stone-700">
        Canvas
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {artifact ? <CanvasArtifactView artifact={artifact.artifact} /> : <EmptyCanvasState />}
      </div>
    </aside>
  )
}

export default CanvasPanel
