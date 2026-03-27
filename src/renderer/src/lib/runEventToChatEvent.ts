import type { LLMEvent } from 'src/shared/chat'
import type { RunEvent } from 'src/shared/run'

export const runEventToChatEvent = (runEvent: RunEvent): LLMEvent | null => {
  const { data } = runEvent.event
  const baseEvent = {
    id: `${runEvent.runId}:${runEvent.sequence}`,
    createdAt: runEvent.createdAt
  }

  if (runEvent.event.type === 'started') {
    return {
      ...baseEvent,
      type: 'stream_start'
    }
  }

  if (runEvent.event.type === 'token') {
    const value = data?.value
    if (typeof value !== 'string') {
      return null
    }

    return {
      ...baseEvent,
      type: 'token',
      value
    }
  }

  if (runEvent.event.type === 'tool_call_start') {
    const toolCallId = data?.toolCallId
    const toolName = data?.toolName
    if (typeof toolCallId !== 'string' || typeof toolName !== 'string') {
      return null
    }

    return {
      ...baseEvent,
      type: 'tool_call_start',
      toolCallId,
      toolName,
      input: data?.input
    }
  }

  if (runEvent.event.type === 'tool_call_end') {
    const toolCallId = data?.toolCallId
    const toolName = data?.toolName
    if (typeof toolCallId !== 'string' || typeof toolName !== 'string') {
      return null
    }

    return {
      ...baseEvent,
      type: 'tool_call_end',
      toolCallId,
      toolName,
      output: data?.output
    }
  }

  if (runEvent.event.type === 'error') {
    return {
      ...baseEvent,
      type: 'stream_error',
      error: typeof data?.error === 'string' ? data.error : 'Run failed.'
    }
  }

  if (runEvent.event.type === 'completed') {
    return {
      ...baseEvent,
      type: 'stream_end'
    }
  }

  return null
}
