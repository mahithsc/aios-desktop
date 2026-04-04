import type { Assistant } from 'src/shared/assistant'
import { create } from 'zustand'

interface AssistantStore {
  assistantsByChatId: Record<string, Assistant | undefined>
  setAssistants: (assistants: Assistant[]) => void
  upsertAssistant: (assistant: Assistant) => void
}

export const useAssistantStore = create<AssistantStore>((set) => ({
  assistantsByChatId: {},

  setAssistants: (assistants) =>
    set({
      assistantsByChatId: Object.fromEntries(assistants.map((assistant) => [assistant.chatId, assistant]))
    }),

  upsertAssistant: (assistant) =>
    set((state) => ({
      assistantsByChatId: {
        ...state.assistantsByChatId,
        [assistant.chatId]: assistant
      }
    }))
}))
