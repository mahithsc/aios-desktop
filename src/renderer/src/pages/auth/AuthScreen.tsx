import { useState, type FormEvent, type JSX } from 'react'
import Input from '@renderer/components/Input'
import { useAuthStore } from '@renderer/store/useAuthStore'

type Mode = 'login' | 'signup'

const AuthScreen = (): JSX.Element => {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submitting = useAuthStore((state) => state.submitting)
  const error = useAuthStore((state) => state.error)
  const login = useAuthStore((state) => state.login)
  const signup = useAuthStore((state) => state.signup)
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle)
  const clearError = useAuthStore((state) => state.clearError)

  const canSubmit = email.trim().length > 0 && password.length >= 8 && !submitting

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!canSubmit) return
    await (mode === 'login' ? login(email, password) : signup(email, password))
  }

  const switchMode = (next: Mode): void => {
    if (next === mode) return
    setMode(next)
    clearError()
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
      <div className="w-[360px] rounded-2xl border border-border bg-card p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <h1 className="mb-1 text-xl font-semibold">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {mode === 'login'
            ? 'Sign in to link and control your devices.'
            : 'Sign up to start linking devices to your account.'}
        </p>

        <button
          type="button"
          disabled={submitting}
          data-testid="auth-google"
          onClick={() => void loginWithGoogle()}
          className="mb-4 w-full rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-testid="auth-form">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            autoFocus
            data-testid="auth-email"
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            data-testid="auth-password"
            onChange={(event) => setPassword(event.target.value)}
          />

          {error ? (
            <p className="px-2 text-sm text-destructive" data-testid="auth-error">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="auth-submit"
            className="mt-2 w-full rounded-full bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                data-testid="auth-switch-signup"
                className="text-foreground underline-offset-2 hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-foreground underline-offset-2 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthScreen
