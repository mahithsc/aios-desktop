import type { JSX } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check, ChevronRight, ChartCandlestick, Image } from 'lucide-react'

type Plugin = {
  name: string
  description: string
  icon: LucideIcon
  accentClassName: string
  installed?: boolean
}

const plugins: Plugin[] = [
  {
    name: 'Polymarket',
    description: 'Track and explore prediction markets',
    icon: ChartCandlestick,
    accentClassName: 'bg-[#111827] text-white',
    installed: true
  },
  {
    name: 'Image Gen Nano Banana',
    description: 'Generate images with Nano Banana',
    icon: Image,
    accentClassName: 'bg-[#F59E0B] text-black'
  }
]

const PluginRow = ({ plugin }: { plugin: Plugin }): JSX.Element => {
  const Icon = plugin.icon

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left transition hover:bg-accent/50"
    >
      <div className="relative shrink-0">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${plugin.accentClassName}`}>
          <Icon className="h-6 w-6" />
        </div>
        {plugin.installed ? (
          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-foreground">
            <Check className="h-3 w-3" strokeWidth={3} />
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-normal text-foreground">{plugin.name}</div>
        <div className="truncate text-sm font-normal text-muted-foreground">{plugin.description}</div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
    </button>
  )
}

const Plugins = (): JSX.Element => {
  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="mx-auto w-full max-w-184 px-4 pb-6 sm:px-6 sm:pb-8">
        <div className="space-y-1">
          {plugins.map((plugin) => (
            <PluginRow key={plugin.name} plugin={plugin} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Plugins
