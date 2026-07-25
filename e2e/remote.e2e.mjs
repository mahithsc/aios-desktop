import { _electron as electron } from 'playwright'

// Assumes a persisted authenticated+paired session (from pair.e2e.mjs) and that
// the box is NOT discoverable on the LAN (mDNS off) but HAS a public tunnel
// (ngrok) reported to the cloud — i.e. the off-LAN case. Verifies the desktop
// reaches the box directly via its tunnel URL (transport "remote").
const CLOUD_URL = process.env.AIOS_CLOUD_URL ?? 'http://127.0.0.1:8100'

const fail = (m) => {
  console.error('FAIL:', m)
  process.exitCode = 1
}
const assert = (c, m) => {
  if (!c) fail(m)
}

const app = await electron.launch({
  args: ['out/main/index.js'],
  env: { ...process.env, AIOS_CLOUD_URL: CLOUD_URL, AIOS_AUTH_INSECURE_STORE: '1' }
})
try {
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await new Promise((r) => setTimeout(r, 1500))
  assert((await win.getByTestId('auth-email').count()) === 0, 'unexpectedly on auth screen')
  assert((await win.getByTestId('pair-screen').count()) === 0, 'unexpectedly on pairing screen')
  console.log('STEP 1 ok: restored authenticated + paired session')

  // Retry until the box's tunnel URL has propagated to the cloud and the
  // command resolves to the direct "remote" (ngrok) path.
  let cmd
  for (let i = 0; i < 20; i++) {
    cmd = await win.evaluate(() => window.api.device.command('ping'))
    if (cmd.transport === 'remote') break
    await new Promise((r) => setTimeout(r, 750))
  }
  assert(cmd.ok === true, `ping failed: ${cmd.error}`)
  assert(cmd.transport === 'remote', `expected remote (ngrok), got ${cmd.transport}`)
  assert(cmd.result?.pong === true, 'ping result missing pong')
  console.log('STEP 2 ok: off-LAN command via ngrok tunnel ->', JSON.stringify(cmd))
} catch (e) {
  fail(e?.message ?? String(e))
} finally {
  await app.close()
}
console.log(process.exitCode ? 'REMOTE: FAIL' : 'REMOTE: PASS')
