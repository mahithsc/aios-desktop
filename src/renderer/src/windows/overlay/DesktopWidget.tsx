import type { JSX } from 'react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'
import ClickableDiv from './components/ClickableDiv'
import DesktopWidgetTextInput from './components/DesktopWidgetTextInput'

const DesktopWidget = (): JSX.Element => {
  const [isPressed, setIsPressed] = useState(false)
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const messages = useChatStore((state) => state.chat.messages)
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const events = lastAssistant?.role === 'assistant' ? lastAssistant.events : []
  const isExpanded = value.length > 40 || value.includes('\n')

  const handleSubmit = (): void => {
    const nextValue = value.trim()
    if (!nextValue) return

    setIsPressed(true)
    addUserMessage(nextValue)
    window.api.sendChat(useChatStore.getState().chat)
    createAssistantMessageStub()
    clearValue()
    window.setTimeout(() => setIsPressed(false), 120)
  }

  return (
    <div className="w-102 max-w-[calc(100vw-2rem)] text-white">
      {events.length > 0 && (
        <ClickableDiv className="mb-2 max-h-60 overflow-y-auto rounded-[24px] border border-white/10 bg-[rgb(40,40,40)]/80 px-4 py-3 text-sm text-white/85 backdrop-blur-xl">
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
        </ClickableDiv>
      )}
      <ClickableDiv
        className="min-h-[50px] rounded-[24px] border border-white/10 bg-black/90 backdrop-blur-xl"
        style={{ width: '100%' }}
      >
        <div
          className={`flex w-full gap-2 px-3 py-2.5 ${isExpanded ? 'flex-col' : 'items-center'}`}
        >
          <div className="flex min-h-7 min-w-0 flex-1 items-center">
            <DesktopWidgetTextInput
              value={value}
              placeholder="Ask AIOS"
              onChange={setValue}
              onSubmit={handleSubmit}
            />
          </div>

          <div
            className={`flex shrink-0 gap-2 ${isExpanded ? 'justify-end pb-1' : 'min-h-7 items-center'}`}
          >
            <motion.button
              type="button"
              onClick={handleSubmit}
              animate={{ scale: isPressed ? 0.97 : 1 }}
              transition={{ duration: 0.1 }}
              className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white px-3 text-sm font-medium leading-none text-black"
            >
              <span className="inline-flex items-center gap-1">
                <span className="leading-none">Answer</span>
                <span className="text-[13px] leading-none">↵</span>
              </span>
            </motion.button>
          </div>
        </div>
      </ClickableDiv>
    </div>
  )
}

export default DesktopWidget
