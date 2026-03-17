import type { JSX, KeyboardEvent } from 'react'
import { useChatStore } from '../../store/useChatSessionStore'
import { useInputStore } from '../../store/useInputStore'

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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
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

      <div className="flex w-full max-w-2xl items-center gap-2.5 rounded-full border border-stone-200 bg-white px-3.5 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-500">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </div>

        <input
          type="text"
          placeholder="Ask anything"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm text-black outline-none placeholder:text-stone-400"
        />

        <button
          type="button"
          onClick={handleSubmit}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:bg-stone-800"
          aria-label="Start chat"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M12 19V5" />
            <path d="m6 11 6-6 6 6" />
          </svg>
        </button>
      </div>

      <section className="w-full max-w-2xl">
        <h2 className="text-sm font-medium text-stone-900">Debrief</h2>
        <div className="mt-3 px-4 py-5 text-sm text-stone-500">No debrief yet</div>
      </section>

      <section className="w-full max-w-2xl">
        <h2 className="text-sm font-medium text-stone-900">Apps</h2>
        <div className="mt-3 px-4 py-5 text-sm text-stone-500">No apps yet</div>
      </section>

      <section className="w-full max-w-2xl">
        <h2 className="text-sm font-medium text-stone-900">Skills</h2>
        <div className="mt-3 px-4 py-5 text-sm text-stone-500">No skills yet</div>
      </section>
    </div>
  )
}

export default Home
