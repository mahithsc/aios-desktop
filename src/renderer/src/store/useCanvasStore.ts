import type { ChatCanvasArtifact } from 'src/shared/canvas'
import { create } from 'zustand'

type CanvasArtifactsByChatId = Record<string, ChatCanvasArtifact | undefined>

interface CanvasStore {
  artifactsByChatId: CanvasArtifactsByChatId
  setCanvasArtifact: (entry: ChatCanvasArtifact) => void
  clearCanvasArtifact: (chatId: string) => void
  getCanvasArtifact: (chatId: string) => ChatCanvasArtifact | undefined
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  artifactsByChatId: {},

  setCanvasArtifact: (entry) =>
    set((state) => {
      console.debug('[canvas]', 'Persisting artifact in canvas store.', {
        chatId: entry.chatId,
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        artifact: entry.artifact,
        previousArtifact: state.artifactsByChatId[entry.chatId],
        knownChatIds: Object.keys(state.artifactsByChatId)
      })
      window.api.logToConsole('debug', '[canvas] Persisting artifact in canvas store.', {
        chatId: entry.chatId,
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        artifact: entry.artifact,
        previousArtifact: state.artifactsByChatId[entry.chatId],
        knownChatIds: Object.keys(state.artifactsByChatId)
      })

      return {
        artifactsByChatId: {
          ...state.artifactsByChatId,
          [entry.chatId]: entry
        }
      }
    }),

  clearCanvasArtifact: (chatId) =>
    set((state) => {
      console.debug('[canvas]', 'Clearing artifact from canvas store.', {
        chatId,
        previousArtifact: state.artifactsByChatId[chatId]
      })
      window.api.logToConsole('debug', '[canvas] Clearing artifact from canvas store.', {
        chatId,
        previousArtifact: state.artifactsByChatId[chatId]
      })

      return {
        artifactsByChatId: {
          ...state.artifactsByChatId,
          [chatId]: undefined
        }
      }
    }),

  getCanvasArtifact: (chatId) => get().artifactsByChatId[chatId]
}))
