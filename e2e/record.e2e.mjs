import { _electron as electron } from 'playwright'

// Captures keyframe screenshots of the onboarding flow into $DIR; the runner
// stitches them into a video with ffmpeg.
const CLOUD_URL = process.env.AIOS_CLOUD_URL ?? 'http://127.0.0.1:8100'
const DIR =
  '/private/tmp/claude-501/-Users-suneetpathangay/eade93d1-d5e0-41d4-8b89-b58102fd5444/scratchpad/video'
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (m) => {
  console.error('FAIL:', m)
  process.exitCode = 1
}

const app = await electron.launch({
  args: ['out/main/index.js'],
  env: { ...process.env, AIOS_CLOUD_URL: CLOUD_URL, AIOS_AUTH_INSECURE_STORE: '1' }
})
const win = await app.firstWindow()
let n = 0
const shot = async (label) => {
  n += 1
  await win.screenshot({ path: `${DIR}/frame-${String(n).padStart(2, '0')}.png` })
  console.log(`frame ${n}: ${label}`)
}

try {
  await win.waitForLoadState('domcontentloaded')
  await win.getByTestId('auth-email').waitFor({ state: 'visible', timeout: 20_000 })
  await pause(500)
  await shot('login screen')

  await win.getByTestId('auth-email').fill(email)
  await win.getByTestId('auth-password').fill(password)
  await shot('credentials entered')
  await win.getByTestId('auth-submit').click()

  await win.getByTestId('pair-button').first().waitFor({ state: 'visible', timeout: 20_000 })
  await pause(500)
  await shot('device discovered on network')
  await win.getByTestId('pair-button').first().click()

  await win.getByTestId('pair-screen').waitFor({ state: 'detached', timeout: 20_000 })
  await pause(1500)
  await shot('paired — app home')
  await pause(1000)
  await shot('app home (held)')

  win.on('dialog', (d) => d.accept())
  await win.getByTestId('unpair-button').click()
  await win.getByTestId('pair-screen').waitFor({ state: 'visible', timeout: 20_000 })
  await pause(800)
  await shot('unpaired — back to pairing')
  console.log('RECORD: flow complete')
} catch (e) {
  fail(e?.message ?? String(e))
} finally {
  await app.close()
}
console.log(process.exitCode ? 'RECORD: FAIL' : 'RECORD: PASS')
