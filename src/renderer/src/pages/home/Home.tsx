import type { JSX, KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'
import ChatComposer from '../agents/components/ChatComposer'

type HomeProps = {
  onOpenAgents: () => void
}

const Home = ({ onOpenAgents }: HomeProps): JSX.Element => {
  const value = useInputStore((state) => state.value)
  const setValue = useInputStore((state) => state.setValue)
  const clearValue = useInputStore((state) => state.clearValue)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const createAssistantMessageStub = useChatStore((state) => state.createAssistantMessageStub)

  const handleSubmit = (): void => {
    const nextValue = value.trim()

    if (!nextValue) {
      return
    }

    addUserMessage(nextValue)
    window.api.sendChat(useChatStore.getState().chat)
    createAssistantMessageStub()
    clearValue()
    onOpenAgents()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.shiftKey) {
      return
    }

    event.preventDefault()
    handleSubmit()
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-lg tracking-tight text-black sm:text-2xl">
          Hi, Mahith what are you working on
        </h1>
      </div>

      <button
        type="button"
        onClick={() => toast.success('Test notification from Sonner')}
        className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-50"
      >
        Show Toast
      </button>

      <ChatComposer
        value={value}
        onChange={setValue}
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
        fixed={false}
        placeholder="Ask anything"
      />
    </div>
  )
}

export default Home
