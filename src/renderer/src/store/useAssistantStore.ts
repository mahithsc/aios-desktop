import type { Assistant, AssistantDetail } from 'src/shared/assistant'
import type {
  AssistantMessage,
  LLMEvent,
  MessageAttachment,
  UserMessage
} from 'src/shared/chat'
import { create } from 'zustand'

type UserMessageInput =
  | string
  | {
      content: string
      attachments?: MessageAttachment[]
    }

const toAssistantSummary = (
  assistant: Assistant | AssistantDetail,
  existing?: Assistant
): Assistant => ({
  id: assistant.id,
  title: assistant.title,
  createdAt: assistant.createdAt,
  updatedAt: Math.max(existing?.updatedAt ?? 0, assistant.updatedAt),
  heartbeatEnabled: assistant.heartbeatEnabled,
  identityPath: assistant.identityPath,
  heartbeatPath: assistant.heartbeatPath,
  memoryPath: assistant.memoryPath
})

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

const upsertAssistantDetail = (
  detailsById: Record<string, AssistantDetail | undefined>,
  assistant: AssistantDetail
): Record<string, AssistantDetail | undefined> => ({
  ...detailsById,
  [assistant.id]: assistant
})

interface AssistantStore {
  assistantsById: Record<string, Assistant | undefined>
  assistantDetailsById: Record<string, AssistantDetail | undefined>
  setAssistants: (assistants: Assistant[]) => void
  upsertAssistant: (assistant: Assistant) => void
  setAssistantDetail: (assistant: AssistantDetail) => void
  addUserMessage: (assistantId: string, message: UserMessageInput) => void
  createAssistantMessageStub: (assistantId: string, turnId: string) => void
  bindAssistantRun: (assistantId: string, turnId: string, runId: string) => void
  addAssistantMessageEvent: (assistantId: string, runId: string, event: LLMEvent) => void
}

export const useAssistantStore = create<AssistantStore>((set) => ({
  assistantsById: {},
  assistantDetailsById: {},

  setAssistants: (assistants) =>
    set((state) => ({
      assistantsById: Object.fromEntries(
        assistants.map((assistant) => [
          assistant.id,
          toAssistantSummary(assistant, state.assistantsById[assistant.id])
        ])
      ),
      assistantDetailsById: Object.fromEntries(
        assistants.map((assistant) => [assistant.id, state.assistantDetailsById[assistant.id]])
      )
    })),

  upsertAssistant: (assistant) =>
    set((state) => ({
      assistantsById: {
        ...state.assistantsById,
        [assistant.id]: toAssistantSummary(assistant, state.assistantsById[assistant.id])
      }
    })),

  setAssistantDetail: (assistant) =>
    set((state) => ({
      assistantsById: {
        ...state.assistantsById,
        [assistant.id]: toAssistantSummary(assistant, state.assistantsById[assistant.id])
      },
      assistantDetailsById: upsertAssistantDetail(state.assistantDetailsById, assistant)
    })),

  addUserMessage: (assistantId, message) =>
    set((state) => {
      const assistant = state.assistantDetailsById[assistantId]
      if (!assistant) {
        return state
      }

      const userMessage = createUserMessage(message)
      const nextAssistant = {
        ...assistant,
        updatedAt: userMessage.createdAt,
        messages: [...assistant.messages, userMessage]
      }

      return {
        assistantsById: {
          ...state.assistantsById,
          [assistantId]: toAssistantSummary(nextAssistant, state.assistantsById[assistantId])
        },
        assistantDetailsById: upsertAssistantDetail(state.assistantDetailsById, nextAssistant)
      }
    }),

  createAssistantMessageStub: (assistantId, turnId) =>
    set((state) => {
      const assistant = state.assistantDetailsById[assistantId]
      if (!assistant) {
        return state
      }

      const assistantMessage = createAssistantMessageStub(turnId)
      const nextAssistant = {
        ...assistant,
        updatedAt: assistantMessage.createdAt,
        messages: [...assistant.messages, assistantMessage]
      }

      return {
        assistantsById: {
          ...state.assistantsById,
          [assistantId]: toAssistantSummary(nextAssistant, state.assistantsById[assistantId])
        },
        assistantDetailsById: upsertAssistantDetail(state.assistantDetailsById, nextAssistant)
      }
    }),

  bindAssistantRun: (assistantId, turnId, runId) =>
    set((state) => {
      const assistant = state.assistantDetailsById[assistantId]
      if (!assistant) {
        return state
      }

      const targetIndex = [...assistant.messages]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(
          ({ message }) => message.role === 'assistant' && message.id === turnId && !message.runId
        )?.index

      if (targetIndex === undefined) {
        return state
      }

      const nextMessages = [...assistant.messages]
      const message = nextMessages[targetIndex]
      if (message.role !== 'assistant') {
        return state
      }

      nextMessages[targetIndex] = {
        ...message,
        runId
      }

      const nextAssistant = {
        ...assistant,
        messages: nextMessages
      }

      return {
        assistantDetailsById: upsertAssistantDetail(state.assistantDetailsById, nextAssistant)
      }
    }),

  addAssistantMessageEvent: (assistantId, runId, event) =>
    set((state) => {
      const assistant = state.assistantDetailsById[assistantId]
      if (!assistant) {
        return state
      }

      const targetIndex = [...assistant.messages]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(({ message }) => message.role === 'assistant' && message.runId === runId)?.index

      if (targetIndex === undefined) {
        const assistantMessage = createAssistantMessage(runId, event)
        const nextAssistant = {
          ...assistant,
          updatedAt: assistantMessage.updatedAt,
          messages: [...assistant.messages, assistantMessage]
        }

        return {
          assistantsById: {
            ...state.assistantsById,
            [assistantId]: toAssistantSummary(nextAssistant, state.assistantsById[assistantId])
          },
          assistantDetailsById: upsertAssistantDetail(state.assistantDetailsById, nextAssistant)
        }
      }

      const nextMessages = [...assistant.messages]
      const currentMessage = nextMessages[targetIndex]
      if (currentMessage.role !== 'assistant') {
        return state
      }

      const messageStatus = getAssistantMessageStatus(event)
      const lastEvent = currentMessage.events[currentMessage.events.length - 1]
      const nextEvents =
        event.type === 'token' && lastEvent?.type === 'token'
          ? [
              ...currentMessage.events.slice(0, -1),
              {
                ...lastEvent,
                value: lastEvent.value + event.value
              }
            ]
          : [...currentMessage.events, event]

      nextMessages[targetIndex] = {
        ...currentMessage,
        updatedAt: event.createdAt,
        status: messageStatus,
        events: nextEvents
      }

      const nextAssistant = {
        ...assistant,
        updatedAt: event.createdAt,
        messages: nextMessages
      }

      return {
        assistantsById: {
          ...state.assistantsById,
          [assistantId]: toAssistantSummary(nextAssistant, state.assistantsById[assistantId])
        },
        assistantDetailsById: upsertAssistantDetail(state.assistantDetailsById, nextAssistant)
      }
    })
}))
