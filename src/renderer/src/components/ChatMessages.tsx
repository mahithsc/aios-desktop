import type { JSX } from 'react'
import type {
  AssistantMessage,
  ChatMessage,
  MessageAttachment,
  StreamCancelledEvent,
  StreamErrorEvent,
  SubagentToolEvent,
  TokenEvent,
  UserMessage
} from 'src/shared/chat'
import Markdown from './Markdown'

type AssistantRenderItem =
  | {
      id: string
      type: 'text'
      value: string
    }
  | {
      id: string
      type: 'tool'
      toolCallId: string
      toolName: string
      status: 'running' | 'complete' | 'error'
      input?: string
      output?: string
      error?: string
      subagentEvents: SubagentToolEvent[]
    }

type SubagentRenderItem =
  | {
      id: string
      type: 'status'
      childRunId: string
      status: 'running' | 'complete' | 'error'
      error?: string | null
    }
  | {
      id: string
      type: 'tool'
      childRunId: string
      toolCallId: string
      toolName: string
      status: 'running' | 'complete' | 'error'
      input?: string
      error?: string | null
    }

type ChatMessagesProps = {
  messages: ChatMessage[]
  bottomSpacerClassName?: string
  darkMode?: boolean
  compact?: boolean
}

const TOOL_PAYLOAD_PREVIEW_LIMIT = 1200
const TOOL_INPUT_TRUNCATE = 80

const getAssistantText = (message: AssistantMessage): string => {
  return message.events
    .filter((event): event is TokenEvent => event.type === 'token')
    .map((event) => event.value)
    .join('')
}

const formatToolPayload = (payload: unknown): string | undefined => {
  if (payload === undefined || payload === null) {
    return undefined
  }

  if (typeof payload === 'string') {
    return payload
  }

  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

const truncateToolPayload = (value?: string): string | undefined => {
  if (!value) {
    return value
  }

  if (value.length <= TOOL_PAYLOAD_PREVIEW_LIMIT) {
    return value
  }

  return `${value.slice(0, TOOL_PAYLOAD_PREVIEW_LIMIT)}\n...`
}

const getAssistantRenderItems = (message: AssistantMessage): AssistantRenderItem[] => {
  const items: AssistantRenderItem[] = []
  const toolIndexById = new Map<string, number>()
  let textBuffer = ''

  const flushText = (): void => {
    if (!textBuffer) {
      return
    }

    items.push({
      id: `${message.id}-text-${items.length}`,
      type: 'text',
      value: textBuffer
    })
    textBuffer = ''
  }

  for (const event of message.events) {
    if (event.type === 'token') {
      textBuffer += event.value
      continue
    }

    if (event.type === 'tool_call_start') {
      flushText()

      const existingIndex = toolIndexById.get(event.toolCallId)
      if (existingIndex !== undefined) {
        const existingItem = items[existingIndex]
        if (existingItem?.type === 'tool') {
          items[existingIndex] = {
            ...existingItem,
            id: event.id,
            toolName: event.toolName,
            status: 'running',
            input: truncateToolPayload(formatToolPayload(event.input))
          }
        }
        continue
      }

      toolIndexById.set(event.toolCallId, items.length)
      items.push({
        id: event.id,
        type: 'tool',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        status: 'running',
        input: truncateToolPayload(formatToolPayload(event.input)),
        subagentEvents: []
      })
      continue
    }

    if (event.type === 'tool_call_end' || event.type === 'tool_call_error') {
      flushText()

      const existingIndex = toolIndexById.get(event.toolCallId)

      if (existingIndex !== undefined) {
        const existingItem = items[existingIndex]

        if (existingItem?.type === 'tool') {
          items[existingIndex] = {
            ...existingItem,
            toolName: event.toolName,
            status: event.type === 'tool_call_end' ? 'complete' : 'error',
            output:
              event.type === 'tool_call_end'
                ? truncateToolPayload(formatToolPayload(event.output))
                : existingItem.output,
            error: event.type === 'tool_call_error' ? event.error : existingItem.error
          }
        }

        continue
      }

      items.push({
        id: event.id,
        type: 'tool',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        status: event.type === 'tool_call_end' ? 'complete' : 'error',
        output:
          event.type === 'tool_call_end'
            ? truncateToolPayload(formatToolPayload(event.output))
            : undefined,
        error: event.type === 'tool_call_error' ? event.error : undefined,
        subagentEvents: []
      })
      continue
    }

    if (event.type === 'subagent_tool_event') {
      flushText()

      const existingIndex = toolIndexById.get(event.parentToolCallId)
      if (existingIndex !== undefined) {
        const existingItem = items[existingIndex]
        if (existingItem?.type === 'tool') {
          items[existingIndex] = {
            ...existingItem,
            subagentEvents: [...existingItem.subagentEvents, event]
          }
        }
        continue
      }

      toolIndexById.set(event.parentToolCallId, items.length)
      items.push({
        id: `${message.id}-subagent-${event.parentToolCallId}`,
        type: 'tool',
        toolCallId: event.parentToolCallId,
        toolName: 'subagent',
        status: 'running',
        subagentEvents: [event]
      })
    }
  }

  flushText()

  return items
}

const getAssistantFallbackText = (message: AssistantMessage): string => {
  const streamError = message.events.some((event) => event.type === 'stream_error')
  const streamCancelled = message.events.some((event) => event.type === 'stream_cancelled')
  if (streamError || streamCancelled) {
    return ''
  }

  if (getAssistantText(message)) {
    return ''
  }

  const hasToolCalls = message.events.some((event) => event.type.startsWith('tool_call_'))
  if (hasToolCalls) {
    return ''
  }

  return message.status === 'error' ? 'The response failed.' : ''
}

const getAssistantStreamError = (message: AssistantMessage): string | null => {
  const streamError = [...message.events]
    .reverse()
    .find((event): event is StreamErrorEvent => event.type === 'stream_error')

  return streamError?.error ?? null
}

const getAssistantCancellationReason = (message: AssistantMessage): string | null => {
  const streamCancelled = [...message.events]
    .reverse()
    .find((event): event is StreamCancelledEvent => event.type === 'stream_cancelled')

  return streamCancelled?.reason ?? null
}

const getToolInputSummary = (input?: string): string | null => {
  if (!input) return null
  const oneLine = input.replace(/\n/g, ' ').trim()
  if (oneLine.length <= TOOL_INPUT_TRUNCATE) return oneLine
  return `${oneLine.slice(0, TOOL_INPUT_TRUNCATE)}...`
}

const getShortRunLabel = (childRunId: string): string => `worker ${childRunId.slice(0, 8)}`

const getSubagentRenderItems = (events: SubagentToolEvent[]): SubagentRenderItem[] => {
  const items: SubagentRenderItem[] = []
  const statusIndexByRunId = new Map<string, number>()
  const toolIndexByRunAndToolId = new Map<string, number>()

  for (const event of events) {
    if (event.childEventType === 'stream_start') {
      if (!statusIndexByRunId.has(event.childRunId)) {
        statusIndexByRunId.set(event.childRunId, items.length)
        items.push({
          id: `${event.id}-status`,
          type: 'status',
          childRunId: event.childRunId,
          status: 'running'
        })
      }
      continue
    }

    if (event.childEventType === 'stream_end' || event.childEventType === 'stream_error') {
      const existingIndex = statusIndexByRunId.get(event.childRunId)
      if (existingIndex === undefined) {
        statusIndexByRunId.set(event.childRunId, items.length)
        items.push({
          id: `${event.id}-status`,
          type: 'status',
          childRunId: event.childRunId,
          status: event.childEventType === 'stream_error' ? 'error' : 'complete',
          error: event.error
        })
        continue
      }

      const existingItem = items[existingIndex]
      if (existingItem?.type === 'status') {
        items[existingIndex] = {
          ...existingItem,
          status: event.childEventType === 'stream_error' ? 'error' : 'complete',
          error: event.error ?? existingItem.error
        }
      }
      continue
    }

    if (!event.toolCallId || !event.toolName) {
      continue
    }

    const toolKey = `${event.childRunId}:${event.toolCallId}`
    const existingIndex = toolIndexByRunAndToolId.get(toolKey)

    if (event.childEventType === 'tool_call_start') {
      if (existingIndex !== undefined) {
        continue
      }

      toolIndexByRunAndToolId.set(toolKey, items.length)
      items.push({
        id: `${event.childRunId}:${event.toolCallId}`,
        type: 'tool',
        childRunId: event.childRunId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        status: 'running',
        input: truncateToolPayload(formatToolPayload(event.input))
      })
      continue
    }

    if (existingIndex !== undefined) {
      const existingItem = items[existingIndex]
      if (existingItem?.type === 'tool') {
        items[existingIndex] = {
          ...existingItem,
          toolName: event.toolName,
          status: event.childEventType === 'tool_call_error' ? 'error' : 'complete',
          error: event.childEventType === 'tool_call_error' ? event.error : existingItem.error
        }
      }
      continue
    }

    toolIndexByRunAndToolId.set(toolKey, items.length)
    items.push({
      id: `${event.childRunId}:${event.toolCallId}`,
      type: 'tool',
      childRunId: event.childRunId,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      status: event.childEventType === 'tool_call_error' ? 'error' : 'complete',
      input: truncateToolPayload(formatToolPayload(event.input)),
      error: event.childEventType === 'tool_call_error' ? event.error : null
    })
  }

  return items
}

const ToolCallCard = ({
  item,
  darkMode
}: {
  item: Extract<AssistantRenderItem, { type: 'tool' }>
  darkMode: boolean
}): JSX.Element => {
  const inputSummary = getToolInputSummary(item.input)
  const isRunning = item.status === 'running'
  const subagentItems = item.toolName === 'subagent' ? getSubagentRenderItems(item.subagentEvents) : []

  return (
    <div className="space-y-2">
      <div
        className={`flex items-baseline gap-2 text-xs ${
          darkMode ? 'text-white/60' : 'text-stone-500'
        } ${isRunning ? 'animate-pulse' : ''}`}
      >
        <span className={`font-medium ${darkMode ? 'text-white/85' : 'text-stone-700'}`}>
          {item.toolName}
        </span>
        {inputSummary ? (
          <span className={`truncate font-mono ${darkMode ? 'text-white/45' : 'text-stone-400'}`}>
            {inputSummary}
          </span>
        ) : null}
        {item.status === 'complete' ? (
          <span className={`text-[11px] ${darkMode ? 'text-white/90' : 'text-stone-900'}`}>OK</span>
        ) : null}
        {item.status === 'error' ? <span className="text-[11px] text-red-500">X</span> : null}
      </div>

      {subagentItems.length > 0 ? (
        <div
          className={`ml-3 space-y-1 border-l pl-3 ${
            darkMode ? 'border-white/10' : 'border-stone-200'
          }`}
        >
          {subagentItems.map((subagentItem) =>
            subagentItem.type === 'status' ? (
              <div
                key={subagentItem.id}
                className={`flex items-center gap-2 text-[11px] ${
                  darkMode ? 'text-white/55' : 'text-stone-500'
                } ${subagentItem.status === 'running' ? 'animate-pulse' : ''}`}
              >
                <span className={darkMode ? 'text-white/75' : 'text-stone-700'}>
                  {getShortRunLabel(subagentItem.childRunId)}
                </span>
                <span>
                  {subagentItem.status === 'running'
                    ? 'running'
                    : subagentItem.status === 'error'
                      ? 'error'
                      : 'done'}
                </span>
                {subagentItem.error ? (
                  <span className="truncate text-red-400">{subagentItem.error}</span>
                ) : null}
              </div>
            ) : (
              <div
                key={subagentItem.id}
                className={`flex items-baseline gap-2 text-[11px] ${
                  darkMode ? 'text-white/50' : 'text-stone-500'
                } ${subagentItem.status === 'running' ? 'animate-pulse' : ''}`}
              >
                <span className={darkMode ? 'text-white/75' : 'text-stone-700'}>
                  {subagentItem.toolName}
                </span>
                {getToolInputSummary(subagentItem.input) ? (
                  <span
                    className={`truncate font-mono ${
                      darkMode ? 'text-white/40' : 'text-stone-400'
                    }`}
                  >
                    {getToolInputSummary(subagentItem.input)}
                  </span>
                ) : null}
                {subagentItem.status === 'complete' ? (
                  <span className={darkMode ? 'text-white/80' : 'text-stone-800'}>OK</span>
                ) : null}
                {subagentItem.status === 'error' ? (
                  <span className="text-red-500">X</span>
                ) : null}
              </div>
            )
          )}
        </div>
      ) : null}
    </div>
  )
}

const StreamingIndicator = ({ darkMode }: { darkMode: boolean }): JSX.Element => (
  <div
    className={`animate-pulse text-sm font-medium ${darkMode ? 'text-white/55' : 'text-stone-400'}`}
  >
    Running...
  </div>
)

const UserAttachmentList = ({
  attachments,
  darkMode
}: {
  attachments: MessageAttachment[]
  darkMode: boolean
}): JSX.Element | null => {
  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap justify-end gap-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
            darkMode ? 'bg-white/10 text-white/75' : 'bg-white text-stone-600'
          }`}
        >
          <span>
            {attachment.kind === 'image'
              ? 'Image'
              : attachment.kind === 'audio'
                ? 'Audio'
                : 'File'}
          </span>
          <span className="max-w-40 truncate">{attachment.name}</span>
        </div>
      ))}
    </div>
  )
}

const UserMessageContent = ({
  message,
  darkMode
}: {
  message: UserMessage
  darkMode: boolean
}): JSX.Element => (
  <div>
    {message.content}
    <UserAttachmentList attachments={message.attachments ?? []} darkMode={darkMode} />
  </div>
)

const AssistantMessageContent = ({
  message,
  darkMode,
  compact
}: {
  message: AssistantMessage
  darkMode: boolean
  compact: boolean
}): JSX.Element => {
  const items = getAssistantRenderItems(message)
  const fallback = getAssistantFallbackText(message)
  const streamError = getAssistantStreamError(message)
  const cancellationReason = getAssistantCancellationReason(message)
  const isActive = message.status === 'pending' || message.status === 'streaming'
  const stackClassName = compact ? 'space-y-2' : 'space-y-3'

  if (items.length === 0) {
    return (
      <div className={stackClassName}>
        {isActive ? <StreamingIndicator darkMode={darkMode} /> : null}
        {fallback ? (
          <div
            className={`whitespace-pre-wrap wrap-break-word ${darkMode ? 'text-white/85' : 'text-stone-800'}`}
          >
            {fallback}
          </div>
        ) : null}
        {streamError ? (
          <div className="whitespace-pre-wrap wrap-break-word rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-sm leading-6 text-red-700">
            {streamError}
          </div>
        ) : null}
        {cancellationReason ? (
          <div className="whitespace-pre-wrap wrap-break-word rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-sm leading-6 text-amber-800">
            {cancellationReason}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={stackClassName}>
      {items.map((item) =>
        item.type === 'text' ? (
          <Markdown key={item.id} darkMode={darkMode}>
            {item.value}
          </Markdown>
        ) : (
          <ToolCallCard key={item.id} item={item} darkMode={darkMode} />
        )
      )}
      {isActive ? <StreamingIndicator darkMode={darkMode} /> : null}
      {streamError ? (
        <div className="whitespace-pre-wrap wrap-break-word rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-sm leading-6 text-red-700">
          {streamError}
        </div>
      ) : null}
      {cancellationReason ? (
        <div className="whitespace-pre-wrap wrap-break-word rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-sm leading-6 text-amber-800">
          {cancellationReason}
        </div>
      ) : null}
    </div>
  )
}

const ChatMessages = ({
  messages,
  bottomSpacerClassName = 'h-40',
  darkMode = false,
  compact = false
}: ChatMessagesProps): JSX.Element => {
  const listGapClassName = compact ? 'space-y-4' : 'space-y-8'
  const assistantContainerClassName = compact
    ? 'min-w-0 w-full max-w-184'
    : 'min-w-0 w-full max-w-184'
  const assistantTextClassName = darkMode
    ? compact
      ? 'text-sm leading-6 text-white/92'
      : 'text-sm leading-7 text-white/92'
    : compact
      ? 'text-sm leading-6 text-stone-800'
      : 'text-sm leading-7 text-stone-800'
  const userBubbleClassName = darkMode
    ? compact
      ? 'inline-block rounded-[16px] bg-white/10 px-3 py-2 text-sm leading-5 text-white/92'
      : 'inline-block rounded-[18px] bg-white/10 px-3 py-2 text-sm leading-6 text-white/92'
    : compact
      ? 'inline-block rounded-[16px] bg-stone-100 px-3 py-2 text-sm leading-5 text-stone-700'
      : 'inline-block rounded-[18px] bg-stone-100 px-3 py-2 text-sm leading-6 text-stone-700'

  return (
    <div className={listGapClassName}>
      {messages.length === 0 ? <div className="min-h-64" /> : null}

      {messages.map((message) => {
        const isAssistant = message.role === 'assistant'

        return (
          <div
            key={message.id}
            className={`flex min-w-0 ${isAssistant ? 'justify-start' : 'justify-end'}`}
          >
            <div className={isAssistant ? assistantContainerClassName : 'max-w-md'}>
              <div
                className={
                  isAssistant ? `min-w-0 max-w-full ${assistantTextClassName}` : userBubbleClassName
                }
              >
                {message.role === 'assistant' ? (
                  <AssistantMessageContent
                    message={message}
                    darkMode={darkMode}
                    compact={compact}
                  />
                ) : (
                  <UserMessageContent message={message} darkMode={darkMode} />
                )}
              </div>
            </div>
          </div>
        )
      })}

      <div className={bottomSpacerClassName} aria-hidden="true" />
    </div>
  )
}

export default ChatMessages
