#!/usr/bin/env node
// E2E: in-app wallet MVP (R-#245 §5, R-#244).
//
// Creates the in-app wallet in the browser, unlocks it, signs in with SIWE and
// verifies that the NextAuth session cookie carries that address.
//
// It needs the branch deployed to the dev site. The dev site serves `main`
// today, where /en/test/wallet does not exist, so the spec SKIPS instead of
// failing when the page is missing.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/in-app-wallet.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary, short,
} from '@pasosdejesus/m/e2e'

const PIN = '123456'

function loadEnvCredentials() {
  for (const envPath of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]) {
    if (fs.existsSync(envPath)) {
      const c = fs.readFileSync(envPath, 'utf8')
      const pk = c.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || c.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = c.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

async function statusOf(page) {
  return page.$eval('[data-testid="wallet-status"]', (el) => el.textContent).catch(() => null)
}

async function waitForStatus(page, expected, timeout) {
  await page.waitForFunction(
    (value) => document.querySelector('[data-testid="wallet-status"]')?.textContent === value,
    { timeout },
    expected,
  )
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (creds) process.env.TEST_PRIVATE_KEY = creds.pk
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, timeout, chainId } = env

  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, creds?.addr, timeout)

  const response = await page.goto(`${base}/en/test/wallet`, { waitUntil: 'domcontentloaded' })
  const notDeployed = !response || response.status() === 404
    || !(await page.$('[data-testid="wallet-test-page"]'))
  if (notDeployed) {
    console.log('[SKIP] /en/test/wallet no está desplegado — la rama mvppwa no está en el sitio de desarrollo')
    await browser.close()
    process.exit(0)
  }

  console.log(`In-app wallet | ${base}\n`)

  // 1. Create the wallet with a PIN
  await page.waitForSelector('[data-testid="wallet-pin"]')
  await page.type('[data-testid="wallet-pin"]', PIN)
  await page.type('[data-testid="wallet-pin-confirm"]', PIN)
  await page.click('[data-testid="wallet-create"]')
  await waitForStatus(page, 'unlocked', timeout)
  const address = await page.$eval('[data-testid="wallet-address"]', (el) => el.textContent)
  if (/^0x[0-9a-fA-F]{40}$/.test(address || '')) ok(`Wallet created: ${short(address)}`)
  else fail(`Unexpected address: ${address}`)

  // 2. It survives a reload (IndexedDB) and asks for the PIN again
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="wallet-pin"]')
  await waitForStatus(page, 'locked', timeout)
  ok('Wallet persisted and locked after reload')

  await page.type('[data-testid="wallet-pin"]', PIN)
  await page.click('[data-testid="wallet-unlock"]')
  await waitForStatus(page, 'unlocked', timeout)
  ok('Unlocked with the PIN')

  // 3. SIWE with the in-app wallet
  await page.click('[data-testid="wallet-signin"]')
  await page.waitForFunction(
    () => document.querySelector('[data-testid="wallet-log"]')?.textContent?.includes('OK signed in'),
    { timeout },
  )
  const session = await page.evaluate(async () => {
    const r = await fetch('/api/auth/session')
    return r.ok ? r.json() : null
  })
  if (session?.address && session.address.toLowerCase() === address.toLowerCase()) {
    ok(`Session cookie is the in-app address: ${short(session.address)}`)
  } else {
    fail(`Session mismatch: ${JSON.stringify(session).slice(0, 160)}`)
  }

  // 4. The wallet-scoped API answers for that address
  const profile = await page.evaluate(async (addr) => {
    const r = await fetch(`/api/profile?walletAddress=${addr}`)
    return { status: r.status }
  }, address)
  if (profile.status === 200) ok('GET /api/profile 200 with the in-app session')
  else fail(`GET /api/profile returned ${profile.status}`)

  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
