import { useState, type JSX, type KeyboardEvent, type ReactNode } from 'react'
import { useChatStore } from '../../store/useChatSessionStore'

const tasks = [
  { id: 'task-1', title: 'Get the home shell feeling calm' },
  { id: 'task-2', title: 'Wire dummy agent activity' },
  { id: 'task-3', title: 'Sketch ambient command flows' },
  { id: 'task-4', title: 'Write launch debrief copy' }
]

const runningAgents = [
  { id: 'agent-1', name: 'Planner' },
  { id: 'agent-2', name: 'Researcher' },
  { id: 'agent-3', name: 'Operator' }
]

const crons = [
  { id: 'cron-1', title: 'Inbox summary', time: '9:30 am' },
  { id: 'cron-2', title: 'Project sync', time: '1:00 pm' },
  { id: 'cron-3', title: 'Evening review', time: '6:00 pm' }
]

type SectionProps = {
  title: string
  children: ReactNode
}

const Section = ({ title, children }: SectionProps): JSX.Element => {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-normal tracking-tight text-stone-800">{title}</h2>
      {children}
    </section>
  )
}

const Home = (): JSX.Element => {
  const [value, setValue] = useState('')
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
    setValue('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    handleSubmit()
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 pb-8">
      <section className="flex flex-col items-center">
        <h1 className="text-3xl font-normal tracking-tight text-stone-900 sm:text-4xl">
          Hi there Mahith
        </h1>
        <div className="mt-5 w-full max-w-2xl rounded-[24px] border border-stone-200 bg-white p-3">
          <div>
            <textarea
              rows={2}
              placeholder="Ask anything..."
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-12 w-full resize-none bg-transparent pt-0.5 text-sm text-stone-700 outline-none placeholder:text-stone-400"
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-stone-200 bg-stone-50 px-3.5 py-1.5 text-xs text-stone-600"
              >
                + Add tabs or files
              </button>
            </div>

            <div className="flex items-center">
              <button
                type="button"
                onClick={handleSubmit}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-white"
                aria-label="Send message"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M12 19V5" />
                  <path d="m6 11 6-6 6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="text-2xl font-medium tracking-tight text-stone-900">
          Yesterday&apos;s debrief
        </h2>
        <p className="mt-3 text-base leading-8 text-stone-700">
          The system spent the morning tightening the main desktop shell, reviewing open tasks, and
          surfacing the next set of design decisions. Two agents remain active and the UI work is
          now moving toward a softer ambient layout with simpler navigation.
        </p>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.3fr_0.9fr_0.8fr]">
        <Section title="Tasks">
          <div className="grid gap-3 sm:grid-cols-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-[22px] border border-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-700"
              >
                {task.title}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Current Agents">
          <div className="space-y-3">
            {runningAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-[22px] border border-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-700"
              >
                {agent.name}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Today">
          <div className="space-y-3">
            {crons.map((cron) => (
              <div
                key={cron.id}
                className="rounded-[22px] border border-stone-200 bg-stone-50 px-5 py-4"
              >
                <div className="text-sm text-stone-700">{cron.title}</div>
                <div className="mt-2 text-sm text-stone-400">{cron.time}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-stone-200 bg-stone-50 p-6">
          <p className="text-sm leading-7 text-stone-700">
            A new system update is available. It includes background improvements to agent startup
            and cleaner task orchestration.
          </p>
          <button
            type="button"
            className="mt-6 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm text-stone-700"
          >
            Update
          </button>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-stone-50 p-6">
          <p className="text-sm leading-7 text-stone-600">
            Ambient mode is active. The command surface stays quiet until new work, debriefs, or
            running agents need attention.
          </p>
        </div>
      </section>
    </div>
  )
}

export default Home
