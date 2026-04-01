export interface CronUpcomingItem {
  id: string
  name: string
  description: string
  schedule?: string | null
  scheduleTimezone?: string | null
  runAtUtc?: string | null
  nextRunAt: number
  lastRunAt?: string | null
  status: string
}

export interface CronUpcomingListResponse {
  crons: CronUpcomingItem[]
}
