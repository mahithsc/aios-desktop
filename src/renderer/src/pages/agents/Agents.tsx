import type { JSX } from 'react'
import Input from '../../components/Input'

const messages = [
  {
    id: 'message-1',
    role: 'assistant',
    content: 'I can help coordinate tasks, answer questions, and route work to the right agent.'
  },
  {
    id: 'message-2',
    role: 'user',
    content: 'Summarize what is happening across the system today.'
  },
  {
    id: 'message-3',
    role: 'assistant',
    content:
      'Two agents are active, one cron is currently running, and the design work for the desktop shell is underway.'
  }
]

const Agents = (): JSX.Element => {
  return (
    <div className="mx-auto flex min-h-[72vh] max-w-5xl flex-col rounded-[28px] border border-stone-200 bg-stone-50 p-5 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-400">Agents</p>
          <h2 className="mt-1 text-2xl font-normal tracking-tight text-stone-900">Chat</h2>
        </div>

        <div className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-500">
          Planner active
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {messages.map((message) => {
          const isAssistant = message.role === 'assistant'

          return (
            <div key={message.id} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-2xl rounded-[24px] px-5 py-4 text-sm leading-7 ${
                  isAssistant ? 'border border-stone-200 bg-white text-stone-700' : 'bg-stone-900 text-white'
                }`}
              >
                {message.content}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-[24px] border border-stone-200 bg-white p-4">
        <Input placeholder="Message an agent..." className="border-stone-200 bg-white shadow-none" />
      </div>
    </div>
  )
}

export default Agents
