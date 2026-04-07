import {
  AssistantMessage,
  Chat,
  ChatMetadata,
  LLMEvent,
  MessageAttachment,
  UserMessage
} from 'src/shared/chat'
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

type UserMessageInput =
  | string
  | {
      content: string
      attachments?: MessageAttachment[]
    }

type ChatMetadataUpdate = {
  chatId: string
  createdAt?: number
  title?: string
  updatedAt: number
  status?: ChatMetadata['status']
  activeRunId?: string | null
  activeStep?: string | null
  preview?: string | null
}

const createUserMessage = (input: UserMessageInput): UserMessage => {
  const now = Date.now()
  const content = typeof input === 'string' ? input : input.content
  const attachments = typeof input === 'string' ? [] : (input.attachments ?? [])

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'complete',
    role: 'user',
    content,
    attachments
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
      : event.type === 'stream_cancelled'
        ? 'cancelled'
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

const getActiveAssistantRunId = (chat: Chat): string | null => {
  const activeMessage = [...chat.messages]
    .reverse()
    .find(
      (message) =>
        message.role === 'assistant' &&
        (message.status === 'pending' || message.status === 'streaming') &&
        !!message.runId
    )

  return activeMessage?.role === 'assistant' ? (activeMessage.runId ?? null) : null
}

const normalizeChatMetadata = (metadata: ChatMetadata): ChatMetadata => {
  if (metadata.status !== 'streaming') {
    return {
      ...metadata,
      activeRunId: null,
      activeStep: null
    }
  }

  return metadata
}

const toChatMetadata = (chat: Chat, existing?: ChatMetadata): ChatMetadata =>
  normalizeChatMetadata({
    id: chat.id,
    title: getChatTitle(chat) ?? existing?.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    status: chat.status,
    activeRunId: getActiveAssistantRunId(chat) ?? existing?.activeRunId ?? null,
    activeStep: chat.status === 'streaming' ? (existing?.activeStep ?? null) : null,
    preview: existing?.preview ?? null
  })

const mergeChatMetadata = (
  existing: ChatMetadata | undefined,
  incoming: ChatMetadata
): ChatMetadata => {
  if (!existing) {
    return normalizeChatMetadata(incoming)
  }

  const incomingIsNewerOrEqual = incoming.updatedAt >= existing.updatedAt

  return normalizeChatMetadata({
    id: incoming.id,
    title: incoming.title ?? existing.title,
    createdAt: existing.createdAt || incoming.createdAt,
    updatedAt: incomingIsNewerOrEqual ? incoming.updatedAt : existing.updatedAt,
    status: incomingIsNewerOrEqual
      ? (incoming.status ?? existing.status)
      : (existing.status ?? incoming.status),
    activeRunId: incomingIsNewerOrEqual
      ? (incoming.activeRunId !== undefined ? incoming.activeRunId : existing.activeRunId)
      : existing.activeRunId,
    activeStep: incomingIsNewerOrEqual
      ? (incoming.activeStep !== undefined ? incoming.activeStep : existing.activeStep)
      : existing.activeStep,
    preview: incomingIsNewerOrEqual
      ? (incoming.preview !== undefined ? incoming.preview : existing.preview)
      : existing.preview
  })
}

const upsertChatHistoryEntry = (
  chatHistory: ChatMetadata[],
  entry: ChatMetadata
): ChatMetadata[] => {
  const existing = chatHistory.find((candidate) => candidate.id === entry.id)
  const nextEntry = mergeChatMetadata(existing, entry)
  const remainingEntries = chatHistory.filter((candidate) => candidate.id !== entry.id)

  return [...remainingEntries, nextEntry].sort((left, right) => right.updatedAt - left.updatedAt)
}

const upsertChatHistory = (chatHistory: ChatMetadata[], chat: Chat): ChatMetadata[] => {
  const existing = chatHistory.find((entry) => entry.id === chat.id)
  return upsertChatHistoryEntry(chatHistory, toChatMetadata(chat, existing))
}

const mergeChatHistory = (
  existingHistory: ChatMetadata[],
  incomingHistory: ChatMetadata[]
): ChatMetadata[] => {
  const incomingIds = new Set(incomingHistory.map((entry) => entry.id))
  const mergedEntries = incomingHistory.map((entry) =>
    mergeChatMetadata(existingHistory.find((candidate) => candidate.id === entry.id), entry)
  )
  const unseenExistingEntries = existingHistory.filter((entry) => !incomingIds.has(entry.id))

  return [...mergedEntries, ...unseenExistingEntries].sort(
    (left, right) => right.updatedAt - left.updatedAt
  )
}

const getAssistantMessageStatus = (event: LLMEvent): AssistantMessage['status'] => {
  if (event.type === 'stream_error') {
    return 'error'
  }

  if (event.type === 'stream_cancelled') {
    return 'cancelled'
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
  addUserMessage: (message: UserMessageInput) => void
  createAssistantMessageStub: (turnId: string) => void
  bindAssistantRun: (turnId: string, runId: string) => void
  addAssistantMessageEvent: (runId: string, event: LLMEvent) => void
  setChat: (chat: Chat) => void
  setChatHistory: (chatHistory: ChatMetadata[]) => void
  updateChatMetadata: (update: ChatMetadataUpdate) => void
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
        state.chat.messages.length > 0
          ? upsertChatHistory(mergeChatHistory(state.chatHistory, chatHistory), state.chat)
          : mergeChatHistory(state.chatHistory, chatHistory)
    })),

  updateChatMetadata: (update) =>
    set((state) => {
      const existing = state.chatHistory.find((entry) => entry.id === update.chatId)
      const currentChat = state.chat.id === update.chatId ? state.chat : null
      const nextEntry = normalizeChatMetadata({
        id: update.chatId,
        title: update.title ?? existing?.title ?? (currentChat ? getChatTitle(currentChat) : undefined),
        createdAt: update.createdAt ?? existing?.createdAt ?? currentChat?.createdAt ?? update.updatedAt,
        updatedAt: update.updatedAt,
        status: update.status ?? existing?.status ?? currentChat?.status,
        activeRunId: update.activeRunId,
        activeStep: update.activeStep,
        preview: update.preview
      })

      return {
        chatHistory: upsertChatHistoryEntry(state.chatHistory, nextEntry)
      }
    }),

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
          ({ message }) => message.role === 'assistant' && message.id === turnId && !message.runId
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
            : messageStatus === 'cancelled'
              ? 'cancelled'
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
