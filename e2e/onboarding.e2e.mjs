import { _electron as electron } from 'playwright'

const CLOUD_URL = process.env.AIOS_CLOUD_URL ?? 'http://127.0.0.1:8100'
const BOX_URL = process.env.AIOS_BOX_URL ?? 'http://127.0.0.1:8765'
const SHOT =
  '/private/tmp/claude-501/-Users-suneetpathangay/eade93d1-d5e0-41d4-8b89-b58102fd5444/scratchpad/desktop-paired.png'

// Credentials of a confirmed Supabase user, created by the runner.
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY

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

  // 1. Sign in with Supabase email/password (unauthenticated gate)
  await win.getByTestId('auth-email').waitFor({ state: 'visible', timeout: 20_000 })
  await win.getByTestId('auth-email').fill(email)
  await win.getByTestId('auth-password').fill(password)
  await win.getByTestId('auth-submit').click()
  console.log('STEP 1 ok: signed in', email)

  // 2. Authenticated but unpaired -> pairing screen with the discovered box
  await win.getByTestId('pair-screen').waitFor({ state: 'visible', timeout: 20_000 })
  await win.getByTestId('pair-button').first().waitFor({ state: 'visible', timeout: 20_000 })
  console.log('STEP 2 ok: pairing screen shows a discovered device')

  // 3. Pair -> screen detaches and the app renders
  await win.getByTestId('pair-button').first().click()
  const pairError = win.getByTestId('pair-error')
  const result = await Promise.race([
    win
      .getByTestId('pair-screen')
      .waitFor({ state: 'detached', timeout: 20_000 })
      .then(() => 'paired'),
    pairError
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(async () => `error: ${await pairError.innerText()}`)
  ])
  assert(result === 'paired', `pairing did not complete (${result})`)
  if (result === 'paired') console.log('STEP 3 ok: paired, app UI rendered')

  await win.screenshot({ path: SHOT })

  // 4. Box confirms it is now claimed by this user
  const boxInfo = await (await fetch(`${BOX_URL}/device/info`)).json()
  assert(boxInfo.paired === true, 'box does not report paired')
  assert(boxInfo.owner_email === email, `box owner mismatch: ${boxInfo.owner_email}`)
  console.log('STEP 4 ok: box reports paired to', boxInfo.owner_email)

  // 5. Cloud registry lists the device under this account. Get a real Supabase
  // token (password grant) and present it to aios-cloud, which verifies it.
  const grant = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ email, password })
    })
  ).json()
  const devices = await (
    await fetch(`${CLOUD_URL}/devices`, {
      headers: { Authorization: `Bearer ${grant.access_token}` }
    })
  ).json()
  assert(Array.isArray(devices) && devices.length === 1, `expected 1 device, got ${devices.length}`)
  assert(devices[0]?.device_id === boxInfo.device_id, 'cloud device_id mismatch with box')
  console.log('STEP 5 ok: cloud registry lists device', devices[0]?.device_id)

  // 6. Lockdown: an unauthenticated WebSocket to the box is refused (Phase 3)
  const wsOutcome = await new Promise((resolve) => {
    const ws = new WebSocket(`${BOX_URL.replace(/^http/, 'ws')}/ws`)
    ws.onopen = () => {
      resolve('opened')
      ws.close()
    }
    ws.onclose = (e) => resolve(`closed:${e.code}`)
    ws.onerror = () => resolve('rejected')
    setTimeout(() => resolve('timeout'), 5_000)
  })
  assert(wsOutcome !== 'opened', `box accepted an unauthenticated WS (${wsOutcome})`)
  console.log('STEP 6 ok: box refused tokenless WebSocket ->', wsOutcome)

  // 7. Local-first command: box is on the LAN here, so it should go direct
  const cmd = await win.evaluate(() => window.api.device.command('ping'))
  assert(cmd.ok === true, `ping failed: ${cmd.error}`)
  assert(cmd.transport === 'lan', `expected lan transport, got ${cmd.transport}`)
  assert(cmd.result?.pong === true, 'ping result missing pong')
  console.log('STEP 7 ok: LAN command ->', JSON.stringify(cmd))

  // 8. Unpair via the header button -> back to the pairing screen, box + cloud cleared
  win.on('dialog', (d) => d.accept()) // accept the "Unpair this device?" confirm
  await win.getByTestId('unpair-button').click()
  await win.getByTestId('pair-screen').waitFor({ state: 'visible', timeout: 20_000 })
  console.log('STEP 8a ok: returned to pairing screen after unpair')

  const boxAfter = await (await fetch(`${BOX_URL}/device/info`)).json()
  assert(boxAfter.paired === false, 'box still reports paired after unpair')

  const devicesAfter = await (
    await fetch(`${CLOUD_URL}/devices`, {
      headers: { Authorization: `Bearer ${grant.access_token}` }
    })
  ).json()
  assert(Array.isArray(devicesAfter) && devicesAfter.length === 0, 'cloud still lists device after unpair')
  console.log('STEP 8b ok: box unpaired + cloud registry empty')
} catch (err) {
  fail(err?.message ?? String(err))
} finally {
  await appProc.close()
}

console.log(process.exitCode ? 'E2E RESULT: FAIL' : 'E2E RESULT: PASS')
