import type { CSSProperties, JSX } from 'react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'
import ChatMessages from '../../components/ChatMessages'
import ClickableDiv from './components/ClickableDiv'
import DesktopWidgetTextInput from './components/DesktopWidgetTextInput'

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

const DesktopWidget = (): JSX.Element => {
  const [isPressed, setIsPressed] = useState(false)
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const newChat = useChatStore((state) => state.newChat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const chat = useChatStore((state) => state.chat)
  const darkMode = true
  const compactMode = true

  const handleSubmit = (): void => {
    const nextValue = value.trim()
    if (!nextValue) {
      return
    }

    const turnId = crypto.randomUUID()
    setIsPressed(true)
    addUserMessage(nextValue)
    const nextChat = useChatStore.getState().chat
    createAssistantMessageStub(turnId)
    window.api.sendSocketMessage({
      type: 'chat.submit',
      data: {
        chat: nextChat,
        turnId
      }
    })
    clearValue()
    window.setTimeout(() => setIsPressed(false), 120)
  }

  const handleNewChat = (): void => {
    newChat()
    clearValue()
  }

  return (
    <div className="w-md max-w-[calc(100vw-2rem)]">
      <ClickableDiv
        className={`overflow-hidden rounded-[24px] border border-border backdrop-blur-xl ${
          darkMode ? 'bg-card/90' : 'bg-card/95'
        }`}
        style={{ width: '100%' }}
      >
        {chat.messages.length > 0 ? (
          <div
            className={`max-h-[80vh] overflow-y-auto ${compactMode ? 'px-3 py-2.5' : 'px-4 py-3'}`}
          >
            <ChatMessages
              messages={chat.messages}
              bottomSpacerClassName="h-0"
              darkMode={darkMode}
              compact={compactMode}
            />
          </div>
        ) : null}

        <div
          className={`flex w-full flex-col gap-2 px-3 py-2.5 ${
            chat.messages.length > 0
              ? 'rounded-t-[24px] border-t border-border bg-background/95'
              : 'bg-background/95'
          }`}
          style={dragRegionStyle}
        >
          <div className="flex min-h-7 min-w-0 flex-1 items-center" style={noDragRegionStyle}>
            <DesktopWidgetTextInput
              value={value}
              placeholder="Ask AIOS"
              onChange={setValue}
              onSubmit={handleSubmit}
              darkMode={darkMode}
            />
          </div>

          <div
            className="flex shrink-0 items-center justify-between gap-2 pb-1"
            style={noDragRegionStyle}
          >
            <button
              type="button"
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium leading-none ${
                darkMode
                  ? 'border-border bg-secondary text-secondary-foreground hover:bg-accent'
                  : 'border-stone-300 bg-stone-100 text-stone-900 hover:bg-stone-200'
              }`}
            >
              +
            </button>
            <div className="flex items-center gap-2">
              {chat.messages.length > 0 ? (
                <button
                  type="button"
                  onClick={handleNewChat}
                  className={`inline-flex h-7 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-medium leading-none ${
                    darkMode
                      ? 'border-border bg-secondary text-secondary-foreground hover:bg-accent'
                      : 'border-stone-300 bg-stone-100 text-stone-900 hover:bg-stone-200'
                  }`}
                >
                  + New Chat
                </button>
              ) : null}
              <motion.button
                type="button"
                onClick={handleSubmit}
                animate={{ scale: isPressed ? 0.97 : 1 }}
                transition={{ duration: 0.1 }}
                className={`inline-flex h-7 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-medium leading-none ${
                  darkMode
                    ? 'border-border bg-primary text-primary-foreground'
                    : 'border-stone-900 bg-stone-900 text-white'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="leading-none">Answer</span>
                  <span className="text-[13px] leading-none">↵</span>
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </ClickableDiv>
    </div>
  )
}

export default DesktopWidget
