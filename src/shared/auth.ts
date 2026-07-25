export interface AuthUser {
  id: string
  email: string
}

export interface AuthState {
  user: AuthUser | null
}

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string }
