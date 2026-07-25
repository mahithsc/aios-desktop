// Fallback box address when LAN discovery finds nothing (see main-process
// DiscoveryService / serverEndpoint). The box's real address is normally
// resolved at runtime via mDNS.
export const SERVER_URL = 'http://localhost:8765'

// aios-cloud relay + accounts service (the trust anchor). Defaults to the
// deployed instance; the main process may override via AIOS_CLOUD_URL (e.g.
// http://localhost:8100 for local dev).
export const CLOUD_URL = 'https://computer.trywink.io'

// Supabase project used for user auth (Google + email). These are client-side
// (publishable) values, safe to ship in the app.
export const SUPABASE_URL = 'https://rwpumukbzlngjbyiinoj.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_itNT4oUgGfUJpkE5ROE_7Q_1_bfSRxf'

// Fixed loopback port for the Google OAuth redirect. This exact URL must be in
// the Supabase Auth "Redirect URLs" allowlist.
export const OAUTH_REDIRECT_PORT = 8971
export const OAUTH_REDIRECT_URL = `http://localhost:${OAUTH_REDIRECT_PORT}/callback`

export const APP_COLORS = {
  background: 'rgb(33 33 33)',
  surface: 'rgb(41 41 41)',
  surfaceElevated: 'rgb(49 49 49)',
  surfaceHighlight: 'rgb(62 62 62)',
  border: 'rgb(74 74 74)',
  text: 'rgb(255 255 255)',
  textMuted: 'rgb(194 194 194)',
  textHighlighted: 'rgb(245 245 245)',
  danger: 'rgb(239 68 68)'
} as const

export const APP_THEME_VARIABLES = {
  '--background': APP_COLORS.background,
  '--foreground': APP_COLORS.text,
  '--card': APP_COLORS.surface,
  '--card-foreground': APP_COLORS.text,
  '--popover': APP_COLORS.surfaceElevated,
  '--popover-foreground': APP_COLORS.text,
  '--primary': APP_COLORS.surfaceHighlight,
  '--primary-foreground': APP_COLORS.textHighlighted,
  '--secondary': APP_COLORS.surfaceElevated,
  '--secondary-foreground': APP_COLORS.textHighlighted,
  '--muted': APP_COLORS.surface,
  '--muted-foreground': APP_COLORS.textMuted,
  '--accent': APP_COLORS.surfaceHighlight,
  '--accent-foreground': APP_COLORS.textHighlighted,
  '--destructive': APP_COLORS.danger,
  '--border': APP_COLORS.border,
  '--input': APP_COLORS.border,
  '--ring': APP_COLORS.surfaceHighlight,
  '--sidebar': APP_COLORS.surface,
  '--sidebar-foreground': APP_COLORS.text,
  '--sidebar-primary': APP_COLORS.surfaceHighlight,
  '--sidebar-primary-foreground': APP_COLORS.textHighlighted,
  '--sidebar-accent': APP_COLORS.surfaceElevated,
  '--sidebar-accent-foreground': APP_COLORS.textHighlighted,
  '--sidebar-border': APP_COLORS.border,
  '--sidebar-ring': APP_COLORS.surfaceHighlight
} as const
