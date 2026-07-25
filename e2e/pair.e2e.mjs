import { _electron as electron } from 'playwright'

// Signs in + pairs, leaving a persisted authenticated+paired session for a
// follow-up test. Requires a confirmed Supabase user (runner creates it).
const CLOUD_URL = process.env.AIOS_CLOUD_URL ?? 'http://127.0.0.1:8100'
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

const fail = (m) => {
  console.error('FAIL:', m)
  process.exitCode = 1
}

const app = await electron.launch({
  args: ['out/main/index.js'],
  env: { ...process.env, AIOS_CLOUD_URL: CLOUD_URL, AIOS_AUTH_INSECURE_STORE: '1' }
})
try {
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await win.getByTestId('auth-email').waitFor({ state: 'visible', timeout: 20_000 })
  await win.getByTestId('auth-email').fill(email)
  await win.getByTestId('auth-password').fill(password)
  await win.getByTestId('auth-submit').click()
  await win.getByTestId('pair-button').first().waitFor({ state: 'visible', timeout: 20_000 })
  await win.getByTestId('pair-button').first().click()
  await win.getByTestId('pair-screen').waitFor({ state: 'detached', timeout: 20_000 })
  console.log('PAIRED ok')
} catch (e) {
  fail(e?.message ?? String(e))
} finally {
  await app.close()
}
console.log(process.exitCode ? 'PAIR: FAIL' : 'PAIR: PASS')
