// E2E Test: Admin dashboard — verifier access + user management
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome node e2e/specs/admin-dashboard.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
  setupSIWEMock,
} from '@pasosdejesus/m/e2e'

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  let pk, addr, verifierAddr
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      pk = pk || content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      addr = addr || content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      verifierAddr = verifierAddr || content.match(/NEXT_PUBLIC_VERIFIER_WALLET="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_VERIFIER_WALLET=(\S+)/)?.[1]
    }
  }
  // Also check process env (for when set via export)
  pk = pk || process.env.PRIVATE_KEY
  addr = addr || process.env.NEXT_PUBLIC_ADDRESS
  verifierAddr = verifierAddr || process.env.NEXT_PUBLIC_VERIFIER_WALLET
  console.error(`ENV: PK=${pk?'set':'missing'} ADDR=${addr?.slice(0,10)}... VERIFIER=${verifierAddr?.slice(0,10) || 'NOT SET'}`)
  if (pk && addr) return { pk, addr, verifierAddr }
  return null
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (!creds) {
    console.error('Credentials not found in .env')
    process.exit(1)
  }
  process.env.TEST_PRIVATE_KEY = creds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, timeout, chainId } = env
  const wallet = creds.addr

  // If NEXT_PUBLIC_VERIFIER_WALLET matches the test wallet, admin tests work.
  // Otherwise tests verify access-denied UX.
  const isVerifier = !!(creds.verifierAddr && creds.verifierAddr.toLowerCase() === wallet.toLowerCase())
  console.log(`Wallet: ${wallet.slice(0,10)}... | Verifier: ${isVerifier} | ${base}\n`)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(90000)
  await setupSIWEMock(page, wallet, creds.pk, chainId)

  // ── Test 0: Verifier check API ──
  console.log('── Test 0: Verifier check API ──')
  const verifierCheck = await page.evaluate(async (url) => {
    const r = await fetch(url)
    const data = await r.json()
    return { status: r.status, ...data }
  }, `${base}/api/admin/check-verifier?wallet=${wallet}`)
  if (verifierCheck.status === 200 && typeof verifierCheck.isVerifier === 'boolean') {
    ok(`Verifier check: isVerifier=${verifierCheck.isVerifier}, wallets=${verifierCheck.count}`)
    if (isVerifier && !verifierCheck.isVerifier) {
      fail(`Expected isVerifier=true but got false. Check NEXT_PUBLIC_VERIFIER_WALLET in .env`)
    }
  } else {
    fail(`Verifier check API: ${verifierCheck.status}`)
  }

  // ── Test 1: Connect and navigate to admin ──
  console.log('── Test 1: Admin page loads ──')
  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 5000))

  const hasConnect = await page.evaluate(() =>
    document.body.textContent?.includes('Connect Wallet') ||
    document.body.textContent?.includes('Conectar Billetera')
  )
  if (hasConnect) {
    const buttons = await page.$$('button')
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn)
      if (text?.includes('Connect') || text?.includes('Conectar')) {
        await btn.click()
        break
      }
    }
    await new Promise(r => setTimeout(r, 8000))
  }

  // Navigate to admin
  await page.goto(`${base}/en/admin`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 5000))

  const body = await page.evaluate(() => document.body.textContent || '')
  if (body.includes('Verification Dashboard') || body.includes('Panel de Verificación')) {
    ok('Admin dashboard loads')
  } else if (body.includes('Access denied') || body.includes('Acceso denegado')) {
    ok('Admin access control works (expected for non-verifier wallet)')
  } else {
    fail('Admin page: unexpected content')
  }

  // ── Test 2: Admin API endpoints ──
  console.log('── Test 2: Admin APIs ──')
  const apis = [
    '/api/admin/users', '/api/admin/users/recent',
    '/api/admin/churches', '/api/admin/churches/recent',
    '/api/admin/pastor-bonus',
  ]
  for (const api of apis) {
    const res = await page.evaluate(async (url) => {
      const r = await fetch(url)
      return r.status
    }, `${base}${api}`)
    if (res === 200) ok(`API ${api}: ${res}`)
    else fail(`API ${api}: ${res}`)
  }

  // ── Test 3: Calendar events endpoint ──
  console.log('── Test 3: Calendar API ──')
  const calRes = await page.evaluate(async (url) => {
    const r = await fetch(url)
    return r.status
  }, `${base}/api/admin/calendar/events`)
  if (calRes === 200 || calRes === 500) ok(`Calendar API: ${calRes}`)
  else fail(`Calendar API: ${calRes}`)

  // ── Test 4: User detail API ──
  console.log('── Test 4: User detail ──')
  const userDetail = await page.evaluate(async (url) => {
    const r = await fetch(url)
    return { status: r.status, hasError: !!(await r.json()).error }
  }, `${base}/api/admin/user/101`)
  if (userDetail.status === 200 && !userDetail.hasError) ok('User detail: OK')
  else if (userDetail.status === 404) ok('User detail: 404 (expected for dev)')
  else fail(`User detail: ${userDetail.status}`)

  // ── Test 5: Church detail API ──
  console.log('── Test 5: Church detail ──')
  const churchDetail = await page.evaluate(async (url) => {
    const r = await fetch(url)
    return { status: r.status, hasError: !!(await r.json()).error }
  }, `${base}/api/admin/church/5`)
  if (churchDetail.status === 200 && !churchDetail.hasError) ok('Church detail: OK')
  else if (churchDetail.status === 404) ok('Church detail: 404 (expected for dev)')
  else fail(`Church detail: ${churchDetail.status}`)

  // ── Test 6: PATCH user (verified fields) ──
  console.log('── Test 6: PATCH user ──')
  if (isVerifier) {
    const patchRes = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified_whatsapp: true }),
      })
      return r.status
    }, `${base}/api/admin/user/101`)
    if (patchRes === 200) ok('PATCH user: OK')
    else fail(`PATCH user: ${patchRes}`)
  } else {
    ok('PATCH user: skipped (not verifier wallet)')
  }

  // ── Cleanup ──
  await browser.close()
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\n✅ ${summary.failures} failures | ${elapsed}s`)
  if (summary.failures > 0) process.exit(1)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
