import type { JSX } from 'react'
import { useMemo, useState } from 'react'
import Agents from './pages/agents/Agents'
import Home from './pages/home/Home'
import { useChatStore } from './store/useChatSessionStore'

type TabId = 'home' | 'agents'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'agents', label: 'Agents' }
]

const AppLayout = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const newChat = useChatStore((state) => state.newChat)

  const content = useMemo(() => {
    if (activeTab === 'agents') {
      return <Agents />
    }

    return <Home onOpenAgents={() => setActiveTab('agents')} />
  }, [activeTab])

  return (
    <main className="h-screen overflow-hidden bg-white px-6 py-5 text-stone-950 sm:px-8 sm:py-6">
      <div className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-col overflow-hidden">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-xs">
              III
            </div>
            <button
              type="button"
              onClick={() => newChat()}
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-50"
            >
              <span className="inline-flex items-center gap-1.5">
                <span>+</span>
                <span>New Chat</span>
              </span>
            </button>
          </div>

          <nav className="justify-self-center flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div className="justify-self-end rounded-full border border-stone-200 bg-white px-4 py-2 text-sm">
            GPT 5.4
          </div>
        </header>

        <div
          className={`flex-1 ${
            activeTab === 'agents'
              ? 'min-h-0 overflow-hidden pt-4 sm:pt-5'
              : 'flex min-h-0 items-start justify-center pt-20 sm:pt-24'
          }`}
        >
          {content}
        </div>
      </div>
    </main>
  )
}

export default AppLayout
