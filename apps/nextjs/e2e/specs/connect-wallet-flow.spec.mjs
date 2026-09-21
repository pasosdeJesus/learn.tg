// E2E Test: Full ConnectWalletButton flow with SIWE-capable mock
// Tests the actual user flow: click Connect → sign → session → reload
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome node e2e/specs/connect-wallet-flow.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
// R-#239: the pdj-wallet core signs (setupSIWEMock retired).
import { installCoreWalletMock, waitForExternalConnect } from '../helpers/in-app-wallet.mjs'
import { resolveSiteTarget } from '../helpers/site-target.mjs'

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const envCreds = loadEnvCredentials()
  if (!envCreds) { console.error('❌ No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = envCreds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { timeout, chainId } = env
  // SITE_URL permite un `bin/dev` local (HTTP).
  const { base } = resolveSiteTarget(env)
  console.log(`Wallet: ${envCreds.addr.slice(0,10)}... | ${base}\n`)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()

  // Full mock with real signing by the pdj-wallet core (survives reloads)
  await installCoreWalletMock(page, { privateKey: envCreds.pk, address: envCreds.addr, chainId })

  // ── Test 1: Connect Wallet on landing ──
  console.log('── Test 1: Connect Wallet visible ──')
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' , timeout: 120000 })
  // Wait for React hydration (can be slow on OpenBSD).
  // R-#238: the header shows `WalletSelector`; the external wallet lives behind
  // "Use external wallet", which this helper clicks until Connect shows up.
  const hasConnect = await waitForExternalConnect(page, { timeout: 45000 })
  if (hasConnect) ok('Connect Wallet visible')
  else fail('Connect Wallet NOT visible')

  // ── Test 2: Click Connect → SIWE → reload → address ──
  console.log('\n── Test 2: Click Connect → SIWE flow ──')
  const buttons = await page.$$('button')
  let clicked = false
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn).catch(() => null)
    if (text?.includes('Connect') || text?.includes('Conectar')) {
      await btn.click().catch(() => {})
      clicked = true
      break
    }
  }
  if (!clicked) { fail('Connect button not found'); await browser.close(); process.exit(1) }
  ok('Clicked Connect Wallet')

  // Wait for reload + check. The page reloads after SIWE, so the evaluate calls
  // can race the navigation (`Execution context was destroyed`).
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 3000))
    let stillConnect = true
    let addr = null
    try {
      stillConnect = await page.evaluate(() =>
        document.body.textContent?.includes('Connect Wallet'))
      addr = await page.evaluate(() => {
        const m = document.body.textContent?.match(/(0x[a-fA-F0-9]{6})[a-fA-F0-9]*...[a-fA-F0-9]{4}/)
        return m ? m[0] : null
      })
    } catch {
      console.log(`  (navigating after SIWE, retry ${i + 1}/12)`)
      continue
    }
    if (!stillConnect) {
      ok(`Connect Wallet replaced after SIWE ${addr ? '(' + addr + ')' : ''}`)
      break
    }
    if (i === 11) fail('Connect Wallet still visible after 36s')
  }

  // ── Test 3: /en shows content ──
  console.log('\n── Test 3: /en renders normally ──')
  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded' , timeout: 120000 })
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const body = await page.evaluate(() =>
      document.body.textContent?.replace(/\s+/g, ' ').trim().substring(0, 60) || '')
    const hasContent = body.length > 50 && !body.startsWith('[data-rk]')
    const hasConnect = body.includes('Connect Wallet')
    const hasAddr = /0x[a-fA-F0-9]{6}/.test(body)
    if (hasContent) {
      ok(`/en renders: ${body.substring(0, 50)}`)
      break
    }
    if (i === 7) console.log(`  /en stuck: "${body}"`)
  }

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
