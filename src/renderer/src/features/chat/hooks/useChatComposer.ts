import { useCallback, useMemo, type KeyboardEventHandler } from 'react'
import { useChatAttachments } from '../../attachments/hooks/useChatAttachments'
import { useChatStore } from '../store/useChatSessionStore'
import { useInputStore } from '../store/useInputStore'

type UseChatComposerOptions = {
  onSubmitted?: () => void
}

type UseChatComposerResult = {
  activeRunId: string | null
  attachments: ReturnType<typeof useChatAttachments>['attachments']
  canStop: boolean
  chat: ReturnType<typeof useChatStore.getState>['chat']
  clearAttachments: () => void
  handleKeyDown: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>
  handleStop: () => void
  handleSubmit: () => void
  isRunning: boolean
  isUploading: boolean
  removeAttachment: (attachmentId: string) => void
  setValue: (value: string) => void
  uploadError: string | null
  uploadFiles: (files: File[]) => Promise<void>
  value: string
}

export const useChatComposer = ({
  onSubmitted
}: UseChatComposerOptions = {}): UseChatComposerResult => {
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const chat = useChatStore((state) => state.chat)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)
  const { attachments, clearAttachments, isUploading, removeAttachment, uploadError, uploadFiles } =
    useChatAttachments(chat.id)

  const activeRunId = useMemo(() => {
    const activeMessage = [...chat.messages]
      .reverse()
      .find(
        (message) =>
          message.role === 'assistant' &&
          (message.status === 'pending' || message.status === 'streaming') &&
          !!message.runId
      )

    return activeMessage?.role === 'assistant' ? (activeMessage.runId ?? null) : null
  }, [chat.messages])

  const isRunning = chat.status === 'streaming'

  const handleSubmit = useCallback((): void => {
    if (isRunning || isUploading) {
      return
    }

    const nextValue = value.trim()

    if (!nextValue && attachments.length === 0) {
      return
    }

    const turnId = crypto.randomUUID()
    addUserMessage({ content: nextValue, attachments })
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
    clearAttachments({ revokePreviewUrls: false })
    onSubmitted?.()
  }, [
    addUserMessage,
    attachments,
    clearAttachments,
    clearValue,
    createAssistantMessageStub,
    isRunning,
    isUploading,
    onSubmitted,
    value
  ])

  const handleStop = useCallback((): void => {
    if (!activeRunId) {
      return
    }

    window.api.sendSocketMessage({
      type: 'run.stop',
      data: {
        runId: activeRunId
      }
    })
  }, [activeRunId])

  const handleKeyDown = useCallback<KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>>(
    (event) => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.shiftKey) {
        return
      }

      event.preventDefault()
      handleSubmit()
    },
    [handleSubmit]
  )

  return {
    activeRunId,
    attachments,
    canStop: Boolean(activeRunId),
    chat,
    clearAttachments,
    handleKeyDown,
    handleStop,
    handleSubmit,
    isRunning,
    isUploading,
    removeAttachment,
    setValue,
    uploadError,
    uploadFiles,
    value
  }
}
