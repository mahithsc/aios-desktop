import type { JSX, KeyboardEvent } from 'react'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'
import type { AssistantMessage, StreamErrorEvent, TokenEvent } from 'src/shared/chat'
import ChatComposer from './components/ChatComposer'
import Markdown from '../../components/Markdown'

const getAssistantText = (message: AssistantMessage): string => {
  return message.events
    .filter((event): event is TokenEvent => event.type === 'token')
    .map((event) => event.value)
    .join('')
}

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
    }

const TOOL_PAYLOAD_PREVIEW_LIMIT = 1200

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

      toolIndexById.set(event.toolCallId, items.length)
      items.push({
        id: event.id,
        type: 'tool',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        status: 'running',
        input: truncateToolPayload(formatToolPayload(event.input))
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
        error: event.type === 'tool_call_error' ? event.error : undefined
      })
    }
  }

  flushText()

  return items
}

const getAssistantFallbackText = (message: AssistantMessage): string => {
  const streamError = message.events.some((event) => event.type === 'stream_error')
  if (streamError) {
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

const TOOL_INPUT_TRUNCATE = 80

const getToolInputSummary = (input?: string): string | null => {
  if (!input) return null
  const oneLine = input.replace(/\n/g, ' ').trim()
  if (oneLine.length <= TOOL_INPUT_TRUNCATE) return oneLine
  return `${oneLine.slice(0, TOOL_INPUT_TRUNCATE)}…`
}

const ToolCallCard = ({
  item
}: {
  item: Extract<AssistantRenderItem, { type: 'tool' }>
}): JSX.Element => {
  const inputSummary = getToolInputSummary(item.input)
  const isRunning = item.status === 'running'

  return (
    <div
      className={`flex items-baseline gap-2 text-xs text-stone-500 ${isRunning ? 'animate-pulse' : ''}`}
    >
      <span className="font-medium text-stone-700">{item.toolName}</span>
      {inputSummary ? (
        <span className="truncate font-mono text-stone-400">{inputSummary}</span>
      ) : null}
      {item.status === 'complete' ? <span className="text-[11px] text-stone-900">✓</span> : null}
      {item.status === 'error' ? <span className="text-[11px] text-red-500">✕</span> : null}
    </div>
  )
}

const StreamingIndicator = (): JSX.Element => (
  <div className="animate-pulse text-sm font-medium text-stone-400">Running...</div>
)

const AssistantMessageContent = ({ message }: { message: AssistantMessage }): JSX.Element => {
  const items = getAssistantRenderItems(message)
  const fallback = getAssistantFallbackText(message)
  const streamError = getAssistantStreamError(message)
  const isActive = message.status === 'pending' || message.status === 'streaming'

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        {isActive ? <StreamingIndicator /> : null}
        {fallback ? <div className="whitespace-pre-wrap wrap-break-word">{fallback}</div> : null}
        {streamError ? (
          <div className="whitespace-pre-wrap wrap-break-word rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-sm leading-6 text-red-700">
            {streamError}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) =>
        item.type === 'text' ? (
          <Markdown key={item.id}>{item.value}</Markdown>
        ) : (
          <ToolCallCard key={item.id} item={item} />
        )
      )}
      {isActive ? <StreamingIndicator /> : null}
      {streamError ? (
        <div className="whitespace-pre-wrap wrap-break-word rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-sm leading-6 text-red-700">
          {streamError}
        </div>
      ) : null}
    </div>
  )
}

const Agents = (): JSX.Element => {
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const chat = useChatStore((state) => state.chat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)

  const handleSubmit = (): void => {
    const nextValue = value.trim()

    if (!nextValue) {
      return
    }

    addUserMessage(nextValue)
    window.api.sendChat(useChatStore.getState().chat)
    createAssistantMessageStub()
    clearValue()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.shiftKey) {
      return
    }

    event.preventDefault()
    handleSubmit()
  }

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-5xl flex-col overflow-hidden">
      <div className="flex-1 min-h-0 space-y-8 overflow-y-auto pt-2 pr-2">
        {chat.messages.length === 0 ? <div className="min-h-64" /> : null}

        {chat.messages.map((message) => {
          const isAssistant = message.role === 'assistant'

          return (
            <div
              key={message.id}
              className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
            >
              <div className={isAssistant ? 'max-w-3xl' : 'max-w-md'}>
                <div
                  className={
                    isAssistant
                      ? 'text-sm leading-7 text-stone-800'
                      : 'inline-block rounded-[18px] bg-stone-100 px-3 py-2 text-sm leading-6 text-stone-700'
                  }
                >
                  {message.role === 'assistant' ? (
                    <AssistantMessageContent message={message} />
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div className="h-40" aria-hidden="true" />
      </div>

      <ChatComposer
        value={value}
        onChange={setValue}
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default Agents
