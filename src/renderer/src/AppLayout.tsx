import type { JSX } from 'react'
import { useMemo, useState } from 'react'
import Agents from './pages/agents/Agents'
import Home from './pages/home/Home'

type TabId = 'home' | 'agents'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'agents', label: 'Agents' }
]

const AppLayout = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<TabId>('home')

  const content = useMemo(() => {
    if (activeTab === 'agents') {
      return <Agents />
    }

    return <Home />
  }, [activeTab])

  return (
    <main className="min-h-screen bg-white px-6 py-5 text-stone-950 sm:px-8 sm:py-6">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-xs">
              III
            </div>
            <div className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm">
              GPT 5.4
            </div>
          </div>

          <nav className="flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
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

          <div className="w-[76px]" aria-hidden="true" />
        </header>

        <div className="flex-1 pt-10 sm:pt-12">{content}</div>
      </div>
    </main>
  )
}

export default AppLayout
