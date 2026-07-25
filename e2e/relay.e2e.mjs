import { _electron as electron } from 'playwright'

// Assumes a prior onboarding run left an authenticated + paired session, and
// that the box is currently NOT discoverable on the LAN (mDNS off) but IS
// connected to the cloud relay — i.e. the "away from home" situation.

const CLOUD_URL = process.env.AIOS_CLOUD_URL ?? 'http://127.0.0.1:8100'

const fail = (msg) => {
  console.error('E2E FAIL:', msg)
  process.exitCode = 1
}
const assert = (cond, msg) => {
  if (!cond) fail(msg)
}

const appProc = await electron.launch({
  args: ['out/main/index.js'],
  env: { ...process.env, AIOS_CLOUD_URL: CLOUD_URL, AIOS_AUTH_INSECURE_STORE: '1' }
})

try {
  const win = await appProc.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await new Promise((r) => setTimeout(r, 1500))

  // Persisted session + pairing should skip both onboarding screens.
  assert((await win.getByTestId('auth-email').count()) === 0, 'unexpectedly on auth screen')
  assert((await win.getByTestId('pair-screen').count()) === 0, 'unexpectedly on pairing screen')
  console.log('STEP 1 ok: restored authenticated + paired session')

  // Box isn't discoverable, so the command must fall back to the cloud relay.
  let cmd
  for (let i = 0; i < 12; i++) {
    cmd = await win.evaluate(() => window.api.device.command('ping'))
    if (cmd.transport === 'relay') break
    await new Promise((r) => setTimeout(r, 500))
  }
  assert(cmd.ok === true, `relay ping failed: ${cmd.error}`)
  assert(cmd.transport === 'relay', `expected relay transport, got ${cmd.transport}`)
  assert(cmd.result?.pong === true, 'relay ping missing pong')
  console.log('STEP 2 ok: off-LAN command via RELAY ->', JSON.stringify(cmd))
} catch (err) {
  fail(err?.message ?? String(err))
} finally {
  await appProc.close()
}

console.log(process.exitCode ? 'E2E RESULT: FAIL' : 'E2E RESULT: PASS')
