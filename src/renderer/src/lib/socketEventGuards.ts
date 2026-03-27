import type { Chat, ChatMetadata, LLMEvent } from 'src/shared/chat'
import type { CanvasArtifact, CanvasToolResult, ChatCanvasArtifact } from 'src/shared/canvas'
import type { Notification, NotificationListResponse } from 'src/shared/notification'
import type { Run, RunEvent } from 'src/shared/run'

const logCanvasDebug = (message: string, details?: Record<string, unknown>): void => {
  console.debug('[canvas]', message, details ?? {})
  window.api.logToConsole('debug', `[canvas] ${message}`, details ?? {})
}

export const isLLMEvent = (value: unknown): value is LLMEvent =>
  typeof value === 'object' && value !== null && 'type' in value && 'createdAt' in value

export const isChat = (value: unknown): value is Chat =>
  typeof value === 'object' && value !== null && 'id' in value && 'messages' in value

export const isChatHistory = (value: unknown): value is ChatMetadata[] => Array.isArray(value)

export const isRunEvent = (value: unknown): value is RunEvent =>
  typeof value === 'object' && value !== null && 'runId' in value && 'event' in value

export const isRun = (value: unknown): value is Run =>
  typeof value === 'object' && value !== null && 'id' in value && 'kind' in value

export const isNotification = (value: unknown): value is Notification =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'title' in value &&
  'body' in value &&
  'createdAt' in value

export const isNotificationListResponse = (value: unknown): value is NotificationListResponse =>
  typeof value === 'object' && value !== null && 'notifications' in value

const isCanvasArtifactKind = (value: unknown): value is CanvasArtifact['kind'] =>
  value === 'image' || value === 'video' || value === 'file'

export const isCanvasArtifact = (value: unknown): value is CanvasArtifact => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  const hasSource = typeof candidate.url === 'string' || typeof candidate.filePath === 'string'

  return candidate.version === 1 && isCanvasArtifactKind(candidate.kind) && hasSource
}

export const isCanvasToolResult = (value: unknown): value is CanvasToolResult => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    candidate.ok === true &&
    candidate.type === 'canvas_artifact' &&
    isCanvasArtifact(candidate.artifact)
  )
}

const parseCanvasToolResult = (value: unknown): CanvasToolResult | null => {
  if (isCanvasToolResult(value)) {
    logCanvasDebug('Canvas tool result matched object payload.')
    return value
  }

  if (typeof value !== 'string') {
    logCanvasDebug('Canvas tool result rejected: output was not an object or string.', {
      outputType: typeof value,
      output: value
    })
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (isCanvasToolResult(parsed)) {
      logCanvasDebug('Canvas tool result matched parsed JSON string payload.')
      return parsed
    }

    logCanvasDebug('Canvas tool result rejected after JSON parse.', {
      parsed
    })
    return null
  } catch {
    logCanvasDebug('Canvas tool result rejected: output string was not valid JSON.', {
      output: value
    })
    return null
  }
}

export const getChatCanvasArtifact = (runEvent: RunEvent): ChatCanvasArtifact | null => {
  if (runEvent.event.type !== 'tool_call_end' || !runEvent.chatId) {
    if (runEvent.event.type === 'tool_call_end') {
      logCanvasDebug('Canvas artifact ignored: tool_call_end missing chatId.', {
        runId: runEvent.runId,
        sequence: runEvent.sequence,
        chatId: runEvent.chatId
      })
    }
    return null
  }

  const data = runEvent.event.data
  const toolCallId = data?.toolCallId
  const toolName = data?.toolName
  const output = parseCanvasToolResult(data?.output)

  if (typeof toolCallId !== 'string' || toolName !== 'show_canvas' || !output) {
    logCanvasDebug('Canvas artifact rejected from run event.', {
      runId: runEvent.runId,
      sequence: runEvent.sequence,
      chatId: runEvent.chatId,
      toolCallId,
      toolName,
      hasOutput: Boolean(output),
      rawOutput: data?.output
    })
    return null
  }

  logCanvasDebug('Canvas artifact accepted from run event.', {
    runId: runEvent.runId,
    sequence: runEvent.sequence,
    chatId: runEvent.chatId,
    toolCallId,
    toolName,
    artifact: output.artifact
  })

  return {
    chatId: runEvent.chatId,
    runId: runEvent.runId,
    toolCallId,
    createdAt: runEvent.createdAt,
    artifact: output.artifact
  }
}
