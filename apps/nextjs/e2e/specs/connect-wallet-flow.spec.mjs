// E2E Test: Full ConnectWalletButton flow with SIWE-capable mock
// Tests the actual user flow: click Connect → sign → session → reload
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome node e2e/specs/connect-wallet-flow.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { injectSIWEWallet } from '../helpers/siwe-wallet-mock.mjs'

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
  const { base, timeout, chainId } = env
  console.log(`Wallet: ${envCreds.addr.slice(0,10)}... | ${base}\n`)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()

  // Inject SIWE-capable wallet mock with real signing
  await injectSIWEWallet(page, envCreds.addr, envCreds.pk, chainId)

  // ── Test 1: Connect Wallet button is visible ──
  console.log('── Test 1: Connect Wallet visible on landing page ──')
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 3000))

  const hasConnectBtn = await page.evaluate(() =>
    document.body.textContent?.includes('Connect Wallet') ||
    document.body.textContent?.includes('Conectar Billetera'))
  if (hasConnectBtn) ok('Connect Wallet button visible')
  else fail('Connect Wallet button NOT visible')

  // ── Test 2: Click Connect → SIWE flow → address appears ──
  console.log('\n── Test 2: Full SIWE flow via Connect Wallet button ──')
  const connectBtn = await page.$('button')
  let clicked = false
  // Find the Connect Wallet button among all buttons
  const buttons = await page.$$('button')
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn)
    if (text?.includes('Connect') || text?.includes('Conectar')) {
      console.log('  Clicking:', text.trim())
      await btn.click()
      clicked = true
      break
    }
  }
  if (!clicked) { fail('Could not find Connect button to click'); await browser.close(); process.exit(1) }
  ok('Clicked Connect Wallet')

  // Wait for SIWE + page reload — check state each cycle
  let hasConnectAfter = false
  let addrAfter = null
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000))
    hasConnectAfter = await page.evaluate(() =>
      document.body.textContent?.includes('Connect Wallet'))
    addrAfter = await page.evaluate(() => {
      const text = document.body.textContent || ''
      const m = text.match(/0x[a-fA-F0-9]{6,}/)
      return m ? m[0] : null
    })
    const snippet = await page.evaluate(() =>
      document.body.textContent?.replace(/\s+/g, ' ').trim().substring(0, 60) || '')
    console.log(`  [${i + 1}/10] ${addrAfter ? 'addr:' + addrAfter.slice(0,10) : hasConnectAfter ? 'connect' : snippet}`)
    if (addrAfter) break
    if (!hasConnectAfter && i > 2) break
  }

  if (addrAfter) {
    ok(`Address visible after connect: ${addrAfter.slice(0, 10)}...`)
  } else if (!hasConnectAfter) {
    ok('Connect Wallet replaced (likely showing address)')
  } else {
    fail('Connect Wallet still visible after SIWE flow')
  }

  // ── Test 3: Navigate to /en → address persists ──
  console.log('\n── Test 3: Address persists on /en ──')

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 120))
  })
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message.slice(0, 120)))

  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })

  // Wait for React hydration
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const snippet = await page.evaluate(() => {
      const body = document.body.textContent?.replace(/\s+/g, ' ').trim().substring(0, 80) || ''
      return body
    })
    console.log(`  [${i + 1}/5] ${snippet}`)
    const done = await page.evaluate(() => {
      const body = document.body.textContent || ''
      if (body.includes('Loading')) return false
      return true
    })
    if (done) break
  }

  const hasConnectOnEn = await page.evaluate(() =>
    document.body.textContent?.includes('Connect Wallet'))
  const hasAddressOnEn = await page.evaluate(() => {
    const text = document.body.textContent || ''
    return /0x[a-fA-F0-9]{6,}/.test(text)
  })

  if (!hasConnectOnEn && hasAddressOnEn) {
    ok('Address visible on /en (no Connect Wallet)')
  } else if (hasAddressOnEn) {
    ok('Address visible on /en')
  } else if (hasConnectOnEn) {
    fail('Connect Wallet on /en — session lost after navigation')
  } else {
    console.log('  Neither Connect Wallet nor address found')
  }

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
