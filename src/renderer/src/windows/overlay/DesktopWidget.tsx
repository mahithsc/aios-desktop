import type { CSSProperties, JSX } from 'react'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'
import ClickableDiv from './components/ClickableDiv'
import DesktopWidgetTextInput from './components/DesktopWidgetTextInput'

type DesktopWidgetProps = { dragRegionStyle: CSSProperties; noDragRegionStyle: CSSProperties }

const DesktopWidget = ({ dragRegionStyle, noDragRegionStyle }: DesktopWidgetProps): JSX.Element => {
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const messages = useChatStore((state) => state.chat.messages)
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const events = lastAssistant?.role === 'assistant' ? lastAssistant.events : []

  const handleSubmit = (): void => {
    const nextValue = value.trim()
    if (!nextValue) return

    addUserMessage(nextValue)
    window.api.sendChat(useChatStore.getState().chat)
    createAssistantMessageStub()
    clearValue()
  }

  return (
    <ClickableDiv className="w-95 text-white">
      {events.length > 0 && (
        <div className="mb-2 max-h-60 overflow-y-auto rounded-2xl bg-zinc-900/90 px-4 py-3 text-sm backdrop-blur-sm">
          {events.map((event) => (
            <span key={event.id}>
              {event.type === 'token' && event.value}
              {event.type === 'stream_start' && '[stream start] '}
              {event.type === 'stream_end' && ' [stream end]'}
              {event.type === 'stream_error' && ` [error: ${event.error}]`}
              {event.type === 'tool_call_start' && `[tool: ${event.toolName}] `}
              {event.type === 'tool_call_end' && `[tool done: ${event.toolName}] `}
              {event.type === 'tool_call_error' && `[tool error: ${event.toolName}] `}
            </span>
          ))}
        </div>
      )}
      <div
        className="flex items-center gap-2 rounded-full bg-zinc-900/90 px-4 py-2 backdrop-blur-sm"
        style={dragRegionStyle}
      >
        <div className="min-w-0 flex-1">
          <DesktopWidgetTextInput
            value={value}
            placeholder="Ask anything"
            noDragRegionStyle={noDragRegionStyle}
            onChange={setValue}
            onSubmit={handleSubmit}
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900"
          style={noDragRegionStyle}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M12 18V6" />
            <path d="m6.5 11.5 5.5-5.5 5.5 5.5" />
          </svg>
        </button>
      </div>
    </ClickableDiv>
  )
}

export default DesktopWidget
