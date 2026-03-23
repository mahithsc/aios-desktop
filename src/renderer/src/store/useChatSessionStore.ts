import { AssistantMessage, Chat, ChatMetadata, LLMEvent, UserMessage } from 'src/shared/chat'
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

const createAssistantMessageStub = (turnId: string): AssistantMessage => {
  const now = Date.now()

  return {
    id: turnId,
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    role: 'assistant',
    events: []
  }
}

const createAssistantMessage = (runId: string, event: LLMEvent): AssistantMessage => ({
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
  runId,
  events: [event]
})

const getChatTitle = (chat: Chat): string | undefined => {
  if (chat.title?.trim()) {
    return chat.title.trim()
  }

  const firstUserMessage = chat.messages.find(
    (message): message is UserMessage => message.role === 'user' && !!message.content.trim()
  )

  if (!firstUserMessage) {
    return undefined
  }

  return firstUserMessage.content.trim().split('\n')[0]?.slice(0, 80)
}

const toChatMetadata = (chat: Chat): ChatMetadata => ({
  id: chat.id,
  title: getChatTitle(chat),
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
  status: chat.status
})

const upsertChatHistory = (chatHistory: ChatMetadata[], chat: Chat): ChatMetadata[] => {
  const nextEntry = toChatMetadata(chat)
  const remainingEntries = chatHistory.filter((entry) => entry.id !== chat.id)

  return [...remainingEntries, nextEntry].sort((left, right) => right.updatedAt - left.updatedAt)
}

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
  chatHistory: ChatMetadata[]
  addUserMessage: (message: string) => void
  createAssistantMessageStub: (turnId: string) => void
  bindAssistantRun: (turnId: string, runId: string) => void
  addAssistantMessageEvent: (runId: string, event: LLMEvent) => void
  setChat: (chat: Chat) => void
  setChatHistory: (chatHistory: ChatMetadata[]) => void
  newChat: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  chat: createDefaultChat(),
  chatHistory: [],

  newChat: () => set({ chat: createDefaultChat() }),

  setChat: (chat) =>
    set((state) => ({
      chat,
      chatHistory: upsertChatHistory(state.chatHistory, chat)
    })),

  setChatHistory: (chatHistory) =>
    set((state) => ({
      chatHistory:
        state.chat.messages.length > 0 ? upsertChatHistory(chatHistory, state.chat) : chatHistory
    })),

  addUserMessage: (message) =>
    set((state) => {
      const userMessage = createUserMessage(message)
      const nextChat = {
        ...state.chat,
        status: 'streaming' as const,
        updatedAt: userMessage.createdAt,
        messages: [...state.chat.messages, userMessage]
      }

      return {
        chat: nextChat,
        chatHistory: upsertChatHistory(state.chatHistory, nextChat)
      }
    }),

  createAssistantMessageStub: (turnId) =>
    set((state) => {
      const assistantMessage = createAssistantMessageStub(turnId)
      const nextChat = {
        ...state.chat,
        updatedAt: assistantMessage.createdAt,
        messages: [...state.chat.messages, assistantMessage]
      }

      return {
        chat: nextChat,
        chatHistory: upsertChatHistory(state.chatHistory, nextChat)
      }
    }),

  bindAssistantRun: (turnId, runId) =>
    set((state) => {
      const targetIndex = [...state.chat.messages]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(
          ({ message }) =>
            message.role === 'assistant' &&
            message.id === turnId &&
            !message.runId
        )?.index

      if (targetIndex === undefined) {
        return state
      }

      const nextMessages = [...state.chat.messages]
      const message = nextMessages[targetIndex]
      if (message.role !== 'assistant') {
        return state
      }

      nextMessages[targetIndex] = {
        ...message,
        runId
      }

      const nextChat = {
        ...state.chat,
        messages: nextMessages
      }

      return {
        chat: nextChat,
        chatHistory: upsertChatHistory(state.chatHistory, nextChat)
      }
    }),

  addAssistantMessageEvent: (runId, event) =>
    set((state) => {
      const targetIndex = [...state.chat.messages]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(({ message }) => message.role === 'assistant' && message.runId === runId)?.index

      if (targetIndex === undefined) {
        const assistantMessage = createAssistantMessage(runId, event)
        const nextChat = {
          ...state.chat,
          updatedAt: assistantMessage.updatedAt,
          messages: [...state.chat.messages, assistantMessage]
        }

        return {
          chat: nextChat,
          chatHistory: upsertChatHistory(state.chatHistory, nextChat)
        }
      }

      const nextMessages = [...state.chat.messages]
      const message = nextMessages[targetIndex]

      if (message.role !== 'assistant') {
        return state
      }

      const messageStatus = getAssistantMessageStatus(event)

      nextMessages[targetIndex] = {
        ...message,
        updatedAt: event.createdAt,
        status: messageStatus,
        events: [...message.events, event]
      }

      const chatStatus =
        messageStatus === 'complete'
          ? 'idle'
          : messageStatus === 'error'
            ? 'error'
            : state.chat.status

      const nextChat = {
        ...state.chat,
        status: chatStatus,
        updatedAt: event.createdAt,
        messages: nextMessages
      }

      return {
        chat: nextChat,
        chatHistory: upsertChatHistory(state.chatHistory, nextChat)
      }
    })
}))
