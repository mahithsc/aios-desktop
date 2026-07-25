import type { AuthUser } from '@shared/auth'
import { create } from 'zustand'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthStore {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  submitting: boolean
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set) => {
  const submit = async (
    action: 'login' | 'signup',
    email: string,
    password: string
  ): Promise<void> => {
    set({ submitting: true, error: null })
    const result = await window.api.auth[action](email.trim(), password)
    if (result.ok) {
      set({ status: 'authenticated', user: result.user, submitting: false, error: null })
    } else {
      set({ submitting: false, error: result.error })
    }
  }

  return {
    status: 'loading',
    user: null,
    error: null,
    submitting: false,

    init: async () => {
      const state = await window.api.auth.getState()
      set({
        status: state.user ? 'authenticated' : 'unauthenticated',
        user: state.user
      })
    },

    login: (email, password) => submit('login', email, password),
    signup: (email, password) => submit('signup', email, password),

    loginWithGoogle: async () => {
      set({ submitting: true, error: null })
      const result = await window.api.auth.google()
      if (result.ok) {
        set({ status: 'authenticated', user: result.user, submitting: false, error: null })
      } else {
        set({ submitting: false, error: result.error })
      }
    },

    logout: async () => {
      await window.api.auth.logout()
      set({ status: 'unauthenticated', user: null, error: null })
    },

    clearError: () => set({ error: null })
  }
})
