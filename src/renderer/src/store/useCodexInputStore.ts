import type { CodexInputRequest } from 'src/shared/ws'
import { create } from 'zustand'

interface CodexInputStore {
  requestsByChatId: Record<string, Record<string, CodexInputRequest> | undefined>
  setRequest: (request: CodexInputRequest) => void
  resolveRequest: (chatId: string, jobId: string) => void
  setError: (chatId: string, jobId: string, error: string) => void
}

export const useCodexInputStore = create<CodexInputStore>((set) => ({
  requestsByChatId: {},

  setRequest: (request) =>
    set((state) => ({
      requestsByChatId: {
        ...state.requestsByChatId,
        [request.chatId]: {
          ...state.requestsByChatId[request.chatId],
          [request.jobId]: request
        }
      }
    })),

  resolveRequest: (chatId, jobId) =>
    set((state) => {
      const requests = state.requestsByChatId[chatId]
      if (!requests?.[jobId]) return state
      const remaining = { ...requests }
      delete remaining[jobId]
      return {
        requestsByChatId: {
          ...state.requestsByChatId,
          [chatId]: Object.keys(remaining).length ? remaining : undefined
        }
      }
    }),

  setError: (chatId, jobId, error) =>
    set((state) => {
      const requests = state.requestsByChatId[chatId]
      const request = requests?.[jobId]
      if (!request || !requests) return state
      return {
        requestsByChatId: {
          ...state.requestsByChatId,
          [chatId]: { ...requests, [jobId]: { ...request, error } }
        }
      }
    })
}))
