import type { CronUpcomingItem } from 'src/shared/cron'
import { create } from 'zustand'

const sortUpcomingCrons = (crons: CronUpcomingItem[]): CronUpcomingItem[] =>
  [...crons].sort((left, right) => left.nextRunAt - right.nextRunAt)

interface CronStore {
  upcomingCrons: CronUpcomingItem[]
  lastUpdatedAt: number | null
  setUpcomingCrons: (crons: CronUpcomingItem[]) => void
  clearUpcomingCrons: () => void
}

export const useCronStore = create<CronStore>((set) => ({
  upcomingCrons: [],
  lastUpdatedAt: null,

  setUpcomingCrons: (crons) =>
    set({
      upcomingCrons: sortUpcomingCrons(crons),
      lastUpdatedAt: Date.now()
    }),

  clearUpcomingCrons: () =>
    set({
      upcomingCrons: [],
      lastUpdatedAt: null
    })
}))
