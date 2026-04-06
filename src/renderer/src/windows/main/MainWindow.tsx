import type { CSSProperties, JSX } from 'react'
import { useState } from 'react'
import Agents from '../../pages/agents/Agents'
import Heartbeats from '../../pages/heartbeats/Heartbeats'
import Home from '../../pages/home/Home'
import Plugins from '../../pages/plugins/Plugins'

type TabId = 'home' | 'agents' | 'plugins'
type MainWindowView =
  | {
      type: 'tab'
      tab: TabId
    }
  | {
      type: 'heartbeats'
    }

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'agents', label: 'Agents' },
  { id: 'plugins', label: 'Plugins' }
]

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

const MainWindow = (): JSX.Element => {
  const [view, setView] = useState<MainWindowView>({
    type: 'tab',
    tab: 'home'
  })

  const handleSelectTab = (tab: TabId): void => {
    setView({
      type: 'tab',
      tab
    })
  }

  const handleOpenHeartbeats = (): void => {
    setView({ type: 'heartbeats' })
  }

  const handleCloseHeartbeats = (): void => {
    setView({
      type: 'tab',
      tab: 'home'
    })
  }

  let content: JSX.Element
  if (view.type === 'heartbeats') {
    content = <Heartbeats onBack={handleCloseHeartbeats} />
  } else if (view.tab === 'agents') {
    content = <Agents />
  } else if (view.tab === 'plugins') {
    content = <Plugins />
  } else {
    content = (
      <Home
        onOpenAgents={() => handleSelectTab('agents')}
        onOpenHeartbeats={handleOpenHeartbeats}
      />
    )
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <header
          className="pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center px-2 pt-2 sm:px-3 sm:pt-3"
          style={dragRegionStyle}
        >
          <div />

          <nav
            className="pointer-events-auto justify-self-center flex items-center gap-1 rounded-full border border-border bg-card p-1"
            style={noDragRegionStyle}
          >
            {tabs.map((tab) => {
              const isActive =
                (view.type === 'tab' && tab.id === view.tab) ||
                (view.type === 'heartbeats' && tab.id === 'home')

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`rounded-full px-4.5 py-1.5 text-sm font-normal transition ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div
            className="pointer-events-auto justify-self-end rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
            style={noDragRegionStyle}
          >
            GPT 5.4
          </div>
        </header>

        <div
          className={`flex-1 ${
            view.type === 'tab' && view.tab === 'agents'
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
