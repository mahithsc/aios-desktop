import { app, safeStorage, shell } from 'electron'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  OAUTH_REDIRECT_PORT,
  OAUTH_REDIRECT_URL
} from '../../shared/config'
import type { AuthResult, AuthState, AuthUser } from '../../shared/auth'

interface StoredSession {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

const useEncryption = (): boolean => {
  if (process.env.AIOS_AUTH_INSECURE_STORE === '1') return false
  return safeStorage.isEncryptionAvailable()
}

/** Seconds until the access token expires, from its `exp` claim (0 if unknown). */
const secondsUntilExpiry = (accessToken: string): number => {
  try {
    const [, payload] = accessToken.split('.')
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as { exp?: number }
    if (!claims.exp) return 0
    return claims.exp - Math.floor(Date.now() / 1000)
  } catch {
    return 0
  }
}

/**
 * Owns the user's Supabase session in the main process. Auth (Google + email)
 * runs against Supabase directly; the resulting access token is what the rest
 * of the app presents to aios-cloud. Tokens are persisted encrypted at rest and
 * never leave the main process — only the user profile crosses to the renderer.
 */
export class AuthService {
  private session: StoredSession | null = null
  private readonly supabase: SupabaseClient

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: 'pkce',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  }

  private get filePath(): string {
    return join(app.getPath('userData'), 'aios-auth.bin')
  }

  async load(): Promise<void> {
    try {
      const buffer = await readFile(this.filePath)
      const json = useEncryption() ? safeStorage.decryptString(buffer) : buffer.toString('utf8')
      this.session = JSON.parse(json) as StoredSession
    } catch {
      this.session = null
    }
  }

  getState(): AuthState {
    return { user: this.session?.user ?? null }
  }

  getAccessToken(): string | null {
    return this.session?.accessToken ?? null
  }

  /** Refresh the access token if it's expired or about to expire. */
  async ensureFreshToken(): Promise<void> {
    if (!this.session) return
    if (secondsUntilExpiry(this.session.accessToken) > 60) return
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: this.session.refreshToken
    })
    if (error || !data.session) return
    await this.storeSession(data.session)
  }

  async loginWithPassword(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) return { ok: false, error: error?.message ?? 'Sign-in failed' }
    return this.storeSession(data.session)
  }

  async signupWithPassword(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signUp({ email, password })
    if (error) return { ok: false, error: error.message }
    if (!data.session) {
      // Email confirmation is required before a session is issued.
      return { ok: false, error: 'Check your email to confirm your account, then sign in.' }
    }
    return this.storeSession(data.session)
  }

  async loginWithGoogle(): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true }
    })
    if (error || !data.url) return { ok: false, error: error?.message ?? 'Could not start Google sign-in' }

    let code: string
    try {
      code = await this.waitForOAuthCode(data.url)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Google sign-in cancelled' }
    }

    const { data: exchanged, error: exchangeError } =
      await this.supabase.auth.exchangeCodeForSession(code)
    if (exchangeError || !exchanged.session) {
      return { ok: false, error: exchangeError?.message ?? 'Google sign-in failed' }
    }
    return this.storeSession(exchanged.session)
  }

  async logout(): Promise<void> {
    this.session = null
    await this.persist()
  }

  /** Run a one-shot loopback server, open the OAuth URL, resolve with the code. */
  private waitForOAuthCode(authUrl: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let server: Server | null = null
      const timer = setTimeout(() => {
        server?.close()
        reject(new Error('Timed out waiting for Google sign-in'))
      }, 180_000)

      server = createServer((req, res) => {
        const url = new URL(req.url ?? '', OAUTH_REDIRECT_URL)
        if (url.pathname !== '/callback') {
          res.writeHead(404).end()
          return
        }
        const code = url.searchParams.get('code')
        const errorDesc = url.searchParams.get('error_description')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="font-family:sans-serif">You can close this tab and return to aios.</body></html>')
        clearTimeout(timer)
        server?.close()
        if (code) resolve(code)
        else reject(new Error(errorDesc ?? 'No authorization code returned'))
      })
      server.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
      server.listen(OAUTH_REDIRECT_PORT, '127.0.0.1', () => {
        void shell.openExternal(authUrl)
      })
    })
  }

  private async storeSession(session: {
    access_token: string
    refresh_token: string
    user: { id: string; email?: string }
  }): Promise<AuthResult> {
    const user: AuthUser = { id: session.user.id, email: session.user.email ?? '' }
    this.session = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user
    }
    await this.persist()
    return { ok: true, user }
  }

  private async persist(): Promise<void> {
    if (!this.session) {
      await rm(this.filePath, { force: true })
      return
    }
    const json = JSON.stringify(this.session)
    const data = useEncryption() ? safeStorage.encryptString(json) : Buffer.from(json, 'utf8')
    await writeFile(this.filePath, data)
  }
}
