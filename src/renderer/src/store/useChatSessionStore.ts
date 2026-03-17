import { AssistantMessage, Chat, LLMEvent, UserMessage } from 'src/shared/chat'
import { create } from 'zustand'

const createDefaultChat = (): Chat => {
  const now = Date.now()

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    messages: []
  }
}

const createUserMessage = (content: string): UserMessage => {
  const now = Date.now()

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'complete',
    role: 'user',
    content
  }
}

const createAssistantMessageStub = (): AssistantMessage => {
  const now = Date.now()

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    role: 'assistant',
    events: []
  }
}

const createAssistantMessage = (event: LLMEvent): AssistantMessage => ({
  id: crypto.randomUUID(),
  createdAt: event.createdAt,
  updatedAt: event.createdAt,
  status:
    event.type === 'stream_error'
      ? 'error'
      : event.type === 'stream_end'
        ? 'complete'
        : 'streaming',
  role: 'assistant',
  events: [event]
})

const getAssistantMessageStatus = (event: LLMEvent): AssistantMessage['status'] => {
  if (event.type === 'stream_error') {
    return 'error'
  }

  if (event.type === 'stream_end') {
    return 'complete'
  }

  if (
    event.type === 'stream_start' ||
    event.type === 'token' ||
    event.type.startsWith('tool_call_')
  ) {
    return 'streaming'
  }

  return 'pending'
}

interface ChatStore {
  chat: Chat
  addUserMessage: (message: string) => void
  createAssistantMessageStub: () => void
  addAssistantMessageEvent: (event: LLMEvent) => void
  newChat: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  chat: createDefaultChat(),

  newChat: () => set({ chat: createDefaultChat() }),

  addUserMessage: (message) =>
    set((state) => {
      const userMessage = createUserMessage(message)

      return {
        chat: {
          ...state.chat,
          status: 'streaming',
          updatedAt: userMessage.createdAt,
          messages: [...state.chat.messages, userMessage]
        }
      }
    }),

  createAssistantMessageStub: () =>
    set((state) => {
      const assistantMessage = createAssistantMessageStub()

      return {
        chat: {
          ...state.chat,
          messages: [...state.chat.messages, assistantMessage]
        }
      }
    }),

  addAssistantMessageEvent: (event) =>
    set((state) => {
      const assistantMessageIndex = [...state.chat.messages]
        .reverse()
        .findIndex((message) => message.role === 'assistant')

      if (assistantMessageIndex === -1) {
        const assistantMessage = createAssistantMessage(event)

        return {
          chat: {
            ...state.chat,
            updatedAt: assistantMessage.updatedAt,
            messages: [...state.chat.messages, assistantMessage]
          }
        }
      }

      const targetIndex = state.chat.messages.length - 1 - assistantMessageIndex
      const nextMessages = [...state.chat.messages]
      const message = nextMessages[targetIndex]

      if (message.role !== 'assistant') {
        return state
      }

      nextMessages[targetIndex] = {
        ...message,
        updatedAt: event.createdAt,
        status: getAssistantMessageStatus(event),
        events: [...message.events, event]
      }

      return {
        chat: {
          ...state.chat,
          updatedAt: event.createdAt,
          messages: nextMessages
        }
      }
    })
}))
