export interface CommandResult {
  ok: boolean
  result?: Record<string, unknown> | null
  error?: string
  /** Which path served the command: direct LAN, direct via the box's public
   * tunnel, cloud relay, or none. */
  transport: 'lan' | 'remote' | 'relay' | 'none'
}
