import type { CSSProperties, JSX } from 'react'
import { useMemo, useState } from 'react'
import Agents from '../../pages/agents/Agents'
import Home from '../../pages/home/Home'

type TabId = 'home' | 'agents'

type MainWindowProps = {
  isOverlayOpen: boolean
  onOpenOverlay: () => void
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'agents', label: 'Agents' }
]

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

const MainWindow = ({ isOverlayOpen, onOpenOverlay }: MainWindowProps): JSX.Element => {
  const [activeTab, setActiveTab] = useState<TabId>('home')

  const content = useMemo(() => {
    if (activeTab === 'agents') {
      if (isOverlayOpen) {
        return (
          <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-stone-200 bg-stone-50 px-6 text-center text-sm text-stone-500">
            Desktop widget is open in a separate window.
          </div>
        )
      }

      return <Agents />
    }

    return <Home onOpenAgents={() => setActiveTab('agents')} />
  }, [activeTab, isOverlayOpen])

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-white text-stone-950">
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <header
          className="pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center px-2 pt-2 sm:px-3 sm:pt-3"
          style={dragRegionStyle}
        >
          <div />

          <nav
            className="pointer-events-auto justify-self-center flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1"
            style={noDragRegionStyle}
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4.5 py-1.5 text-sm font-normal transition ${
                    isActive ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div
            className="pointer-events-auto justify-self-end flex items-center gap-3"
            style={noDragRegionStyle}
          >
            <button
              type="button"
              onClick={onOpenOverlay}
              disabled={isOverlayOpen}
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-white"
            >
              {isOverlayOpen ? 'Desktop Widget Open' : 'Open Desktop Widget'}
            </button>
            <div className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm">
              GPT 5.4
            </div>
          </div>
        </header>

        <div
          className={`flex-1 ${
            activeTab === 'agents'
              ? 'min-h-0 overflow-hidden'
              : 'flex min-h-0 items-start justify-center overflow-y-auto pt-20 sm:pt-24'
          }`}
        >
          {content}
        </div>
      </div>
    </main>
  )
}

export default MainWindow
