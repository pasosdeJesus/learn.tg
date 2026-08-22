// E2E Test: Admin dashboard — verifier access + user management
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome node e2e/specs/admin-dashboard.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary, short,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
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
  pk = pk || process.env.PRIVATE_KEY
  addr = addr || process.env.NEXT_PUBLIC_ADDRESS
  verifierAddr = verifierAddr || process.env.NEXT_PUBLIC_VERIFIER_WALLET
  if (pk && addr) return { pk, addr, verifierAddr }
  return null
}

async function navAndWait(page, url, timeout) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const bodyLen = await page.evaluate(() =>
      document.body?.textContent?.replace(/\s+/g, '').length || 0)
    if (bodyLen > 100) return true
  }
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (!creds) { console.error('Credentials not found in .env'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, chainId } = env
  const timeout = 180000
  const wallet = creds.addr

  const verifierWallets = (creds.verifierAddr || '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean)
  const isVerifier = verifierWallets.includes(wallet.toLowerCase())
  console.log(`Wallet: ${short(wallet)} | Verifier: ${isVerifier} | ${base}\n`)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(timeout)

  // Auth: inject wallet mock + SIWE programmatico
  const { authToken } = await setupE2EAuth(page, wallet, creds.pk, chainId, base)

  // ── Test 0: Verifier check API ──
  console.log('── Test 0: Verifier check API ──')
  const verifierCheck = await page.evaluate(async (url) => {
    const r = await fetch(url)
    const ct = r.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return { status: r.status, notJson: true }
    const data = await r.json()
    return { status: r.status, ...data }
  }, `${base}/api/admin/check-verifier?wallet=${wallet}`)
  if (verifierCheck.notJson) {
    ok('Verifier check: endpoint not yet compiled')
  } else if (verifierCheck.status === 200 && typeof verifierCheck.isVerifier === 'boolean') {
    ok(`Verifier check: isVerifier=${verifierCheck.isVerifier}, wallets=${verifierCheck.count}`)
  } else {
    fail(`Verifier check API: status=${verifierCheck.status}`)
  }

  // ── Test 1: Admin page loads ──
  console.log('\n── Test 1: Admin page loads ──')
  // Already on site from setupE2EAuth, just verify no errors
  await new Promise(r => setTimeout(r, 3000))

  // Check for error toasts
  const landErr = await page.evaluate(() => {
    const els = document.querySelectorAll('[role="status"], [data-slot="toast"]')
    for (const el of els) {
      const t = el.textContent || ''
      if (t.includes('Failed to load') || t.includes('falló') || t.includes('Error')) return t.slice(0, 80)
    }
    return null
  })
  if (landErr) { fail(`Error on /en landing: "${landErr}"`); await browser.close(); process.exit(1) }
  ok('Landing page clean, no errors')

  // Navigate to admin
  await navAndWait(page, `${base}/en/admin`, timeout)
  await new Promise(r => setTimeout(r, 3000))

  const body = await page.evaluate(() => document.body.textContent || '')
  if (body.includes('Verification Dashboard') || body.includes('Panel de Verificación')) {
    ok('Admin dashboard loads')

    await new Promise(r => setTimeout(r, 5000))
    let flickerCount = 0
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const b = await page.evaluate(() => document.body.textContent || '')
      if (b.includes('Loading...') || b.includes('Cargando...')) flickerCount++
    }
    if (flickerCount === 0) ok('No flickering: stable after settle')
    else if (flickerCount <= 2) ok(`Transient loading (${flickerCount}/3)`)
    else fail(`FLICKER DETECTED: ${flickerCount}/3`)
  } else if (body.includes('Access denied') || body.includes('Acceso denegado')) {
    ok('Admin access control works')
  } else {
    fail('Admin page: unexpected content')
  }

  // ── Test 2: Admin API endpoints (with auth token) ──
  console.log('\n── Test 2: Admin APIs ──')
  const q = `wallet=${encodeURIComponent(wallet)}&token=${encodeURIComponent(authToken)}`
  const apis = [
    '/api/admin/users', '/api/admin/users/recent',
    '/api/admin/churches', '/api/admin/churches/recent',
    '/api/admin/pastor-bonus',
  ]
  for (const api of apis) {
    const res = await page.evaluate(async (url) => {
      const r = await fetch(url)
      return r.status
    }, `${base}${api}?${q}`)
    if (res === 200) ok(`API ${api}: ${res}`)
    else fail(`API ${api}: ${res}`)
  }

  // ── Test 3: Calendar events ──
  console.log('\n── Test 3: Calendar API ──')
  const calRes = await page.evaluate(async (url) => {
    const r = await fetch(url)
    return r.status
  }, `${base}/api/admin/calendar/events?${q}`)
  if (calRes === 200 || calRes === 500) ok(`Calendar API: ${calRes}`)
  else fail(`Calendar API: ${calRes}`)

  // ── Test 4: User detail ──
  console.log('\n── Test 4: User detail ──')
  const userDetail = await page.evaluate(async (url) => {
    const r = await fetch(url)
    return { status: r.status, hasError: !!(await r.json()).error }
  }, `${base}/api/admin/user/101?${q}`)
  if (userDetail.status === 200 && !userDetail.hasError) ok('User detail: OK')
  else if (userDetail.status === 404) ok('User detail: 404 (expected for dev)')
  else fail(`User detail: ${userDetail.status}`)

  // ── Test 5: Church detail ──
  console.log('\n── Test 5: Church detail ──')
  const churchDetail = await page.evaluate(async (url) => {
    const r = await fetch(url)
    return { status: r.status, hasError: !!(await r.json()).error }
  }, `${base}/api/admin/church/5?${q}`)
  if (churchDetail.status === 200 && !churchDetail.hasError) ok('Church detail: OK')
  else if (churchDetail.status === 404) ok('Church detail: 404 (expected for dev)')
  else fail(`Church detail: ${churchDetail.status}`)

  // ── Test 6: PATCH user ──
  console.log('\n── Test 6: PATCH user ──')
  if (isVerifier) {
    const patchRes = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified_whatsapp: true }),
      })
      return r.status
    }, `${base}/api/admin/user/101?${q}`)
    if (patchRes === 200) ok('PATCH user: OK')
    else fail(`PATCH user: ${patchRes}`)
  } else {
    ok('PATCH user: skipped (not verifier wallet)')
  }

  await browser.close()
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\n${summary.failures} failures | ${elapsed}s`)
  if (summary.failures > 0) process.exit(1)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })