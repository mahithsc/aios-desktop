export interface CommandResult {
  ok: boolean
  result?: Record<string, unknown> | null
  error?: string
  /** Whether the direct device request was served. */
  transport: 'lan' | 'none'
}
