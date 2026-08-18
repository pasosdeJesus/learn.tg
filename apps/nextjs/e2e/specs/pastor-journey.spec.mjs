#!/usr/bin/env node
// E2E Test: New Pastor Full Journey (Sierra Leone)
//
// Simulates a brand-new pastor with a freshly generated wallet:
//   1. Pastor connects (SIWE) and fills fictitious Sierra Leone profile data.
//   2. Verifier wallet (from apps/.env) signs in and verifies the pastor's
//      data + church registration via the admin API.
//   3. Pastor signs back in, claims CELO UBI in Web3 & UBI guide 3, and
//      checks for the 44 SLEARN welcome bonus.
//
// PREREQUISITE: the verifier wallet (PRIVATE_KEY / NEXT_PUBLIC_ADDRESS in
// apps/.env) must be whitelisted as a verifier on the dev server, and the
// churches fund wallet must hold SLEARN for the 44 SLEARN bonus transfer.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     node e2e/specs/pastor-journey.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import axios from 'axios'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from 'viem/accounts'
import {
  initTestEnv, launchBrowser, resetFailures, fail, ok, summary,
  setupSIWEMock, short,
} from '@pasosdejesus/m/e2e'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

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

function updateCookies(current, setCookieHeaders) {
  const map = new Map()
  if (current) {
    current.split(';').forEach(c => {
      const [name, ...rest] = c.trim().split('=')
      if (name && rest.length) map.set(name, `${name}=${rest.join('=')}`)
    })
  }
  if (setCookieHeaders) {
    setCookieHeaders.forEach(h => {
      const c = h.split(';')[0].trim()
      const [name, ...rest] = c.split('=')
      if (name && rest.length) map.set(name, c)
    })
  }
  return Array.from(map.values()).join('; ')
}

/** HTTP SIWE sign-in (returns csrf token reused as API auth token + cookies). */
async function siweSignIn(privateKey, address) {
  const account = privateKeyToAccount(privateKey)
  const csrfRes = await axios.get(`${SITE}/api/auth/csrf`, { httpsAgent })
  const csrfToken = csrfRes.data.csrfToken
  if (!csrfToken) throw new Error('No CSRF token received')

  let cookies = ''
  if (csrfRes.headers['set-cookie']) cookies = updateCookies(cookies, csrfRes.headers['set-cookie'])

  const siweMessage = new SiweMessage({
    domain: new URL(SITE).host,
    address,
    statement: 'Sign in to Learn through games with DIVVI tracking.',
    uri: SITE,
    version: '1',
    chainId: CHAIN_ID,
    nonce: csrfToken,
    issuedAt: new Date().toISOString(),
  })
  const message = siweMessage.prepareMessage()
  const signature = await account.signMessage({ message })

  const formData = new URLSearchParams()
  formData.append('csrfToken', csrfToken)
  formData.append('message', message)
  formData.append('signature', signature)
  formData.append('redirect', 'false')
  formData.append('callbackUrl', `${SITE}/`)
  formData.append('json', 'true')

  const res = await axios.post(`${SITE}/api/auth/callback/credentials`, formData.toString(), {
    httpsAgent,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    maxRedirects: 0,
    validateStatus: s => s < 400,
  })
  if (res.headers['set-cookie']) cookies = updateCookies(cookies, res.headers['set-cookie'])

  return { token: csrfToken, cookies, address }
}

/** HTTP GET with verifier cookies. */
async function apiGet(path, params, cookies) {
  const url = new URL(path, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.get(url.toString(), { httpsAgent, headers: cookies ? { Cookie: cookies } : {} })
  return res.data
}

/** HTTP PATCH with verifier cookies. */
async function apiPatch(path, body, params, cookies) {
  const url = new URL(path, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.patch(url.toString(), body, {
    httpsAgent,
    headers: cookies ? { 'Content-Type': 'application/json', Cookie: cookies } : {},
  })
  return res.data
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

  const verifier = loadEnvCredentials()
  if (!verifier) { console.error('[ERROR] No verifier credentials found'); process.exit(1) }

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  // 1. Generate a brand-new pastor wallet.
  const pastorPk = generatePrivateKey()
  const pastorAddr = privateKeyToAddress(pastorPk)
  console.log(`Pastor wallet:  ${short(pastorAddr)}`)
  console.log(`Verifier wallet: ${short(verifier.addr)}`)

  const env = await initTestEnv()
  const { base, chainId } = env
  const timeout = 120000

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await setupSIWEMock(page, pastorAddr, pastorPk, chainId)

  // Diagnostic capture (REQ/208): log everything the browser sees so we can
  // tell hydration-failure apart from slow on-demand compilation, a client
  // JS error, or a missing window.ethereum mock.
  const browserEvents = []
  page.on('console', (m) => browserEvents.push(`[console.${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => browserEvents.push(`[pageerror] ${e.message}`))
  page.on('requestfailed', (r) =>
    browserEvents.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText || ''}`))
  page.on('response', (r) => {
    if (r.request().resourceType() === 'script' && !r.ok()) {
      browserEvents.push(`[script ${r.status()}] ${r.url()}`)
    }
  })

  // ════════════════════════════════════════════════════════════════
  // Step 1: Pastor connects wallet
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 1: Pastor connects wallet ──')
  const tGoto = Date.now()
  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })
  let hasConnect = false
  let lastProbe = null
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 3000))
    lastProbe = await page.evaluate(() => ({
      hasEthereum: typeof window.ethereum !== 'undefined',
      hasNextData: typeof window.__NEXT_DATA__ !== 'undefined',
      buttonCount: document.querySelectorAll('button').length,
      hasConnectText: (document.body.textContent || '')
        .includes('Connect Wallet') || (document.body.textContent || '')
        .includes('Conectar Billetera'),
    }))
    hasConnect = lastProbe.hasConnectText
    if (hasConnect) break
  }
  if (!hasConnect) {
    console.log(`[DIAG] goto→poll elapsed=${Date.now() - tGoto}ms lastProbe=`, JSON.stringify(lastProbe))
    console.log('[DIAG] browser events:\n' + browserEvents.join('\n'))
    fail('Connect Wallet not visible')
    await browser.close()
    process.exit(1)
  }

  const connectBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Connect') || (b.textContent || '').includes('Conectar'))
  )
  if (!connectBtn.asElement()) { fail('Connect button not found'); await browser.close(); process.exit(1) }
  await connectBtn.asElement().click()
  ok('Clicked Connect')

  let connected = false
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000))
    try {
      const stillConnect = await page.evaluate(() =>
        document.body.textContent?.includes('Connect Wallet'))
      if (!stillConnect) { connected = true; ok('Pastor SIWE complete'); break }
    } catch (e) {
      // window.location.reload() after SIWE destroys the execution context;
      // this is expected — retry on the next poll.
    }
  }
  if (!connected) {
    const probe = await page.evaluate(() => ({
      text: (document.body?.textContent || '').slice(0, 500),
      buttons: [...document.querySelectorAll('button')].map((b) => b.textContent?.trim()),
      lsAddr: localStorage.getItem('learn.tg.sessionAddress')?.slice(0, 12),
      lsToken: localStorage.getItem('learn.tg.authToken')?.slice(0, 12),
    })).catch((e) => ({ evalError: e.message }))
    console.log('[DIAG] SIWE failure probe:', JSON.stringify(probe, null, 2))
    console.log('[DIAG] browser events:\n' + browserEvents.join('\n'))
    fail('Pastor SIWE did not complete')
    await browser.close()
    process.exit(1)
  }
  await new Promise(r => setTimeout(r, 4000))

  // ════════════════════════════════════════════════════════════════
  // Step 2: Pastor fills fictitious Sierra Leone profile via API
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 2: Pastor fills profile (Sierra Leone) ──')
  const profileRes = await page.evaluate(async (data) => {
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const token = localStorage.getItem('learn.tg.authToken') || ''
    const url = `/api/profile?walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(token)}`
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return { ok: r.ok, status: r.status, body: await r.text() }
  }, {
    nombre: 'Pastor E2E Test',
    email: 'pastor-e2e@learn.tg',
    whatsapp: '+23276123456',
    pais_id: 694,                       // Sierra Leone
    religion_id: 1,
    church_relationship: 'pastor',
    position_israel_gaza: 'no',
    place_of_worship: 'E2E Test Church',
    registration: 'E2E-REG-001',
    denomination: 'E2E Denomination',
  })
  if (profileRes.ok) ok('Pastor profile saved')
  else fail(`Profile PATCH failed: ${profileRes.status} ${profileRes.body.slice(0, 120)}`)

  // Fetch pastor userId + score
  const pastorProfile = await page.evaluate(async () => {
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const token = localStorage.getItem('learn.tg.authToken') || ''
    const url = `/api/profile?walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(token)}`
    const r = await fetch(url)
    return r.ok ? r.json() : null
  })
  if (!pastorProfile?.id) { fail('Could not read pastor profile id'); await browser.close(); process.exit(1) }
  const pastorUserId = pastorProfile.id
  ok(`Pastor userId: ${pastorUserId}, score: ${pastorProfile.profilescore}`)

  // ════════════════════════════════════════════════════════════════
  // Step 3: Verifier signs in (HTTP) and verifies pastor
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 3: Verifier verifies pastor ──')
  let vAuth
  try {
    vAuth = await siweSignIn(verifier.pk, verifier.addr)
    ok('Verifier SIWE sign-in OK')
  } catch (e) {
    fail(`Verifier SIWE failed: ${e.message}`)
    await browser.close(); process.exit(1)
  }

  const vCheck = await apiGet('/api/admin/check-verifier', { wallet: verifier.addr }, vAuth.cookies)
  if (vCheck.isVerifier) ok('Verifier confirmed')
  else { fail('Verifier wallet not whitelisted'); await browser.close(); process.exit(1) }

  // Verify the pastor's data + church registration.
  const verifyRes = await apiPatch(
    `/api/admin/user/${pastorUserId}`,
    {
      passport_name: 'Pastor E2E Test',
      passport_nationality: 694,
      verified_email: 'pastor-e2e@learn.tg',
      verified_whatsapp: '+23276123456',
      verified_place_of_worship: 'E2E Test Church',
      verified_church_relationship: 'pastor',
    },
    { wallet: verifier.addr, token: vAuth.token },
    vAuth.cookies,
  )
  if (verifyRes?.success || verifyRes?.user) {
    ok(`Verifier verified pastor — new score: ${verifyRes.user?.profilescore}`)
  } else {
    fail(`Verifier PATCH failed: ${JSON.stringify(verifyRes).slice(0, 140)}`)
  }

  // ════════════════════════════════════════════════════════════════
  // Step 4: Pastor signs back in and claims UBI in Web3 & UBI guide 3
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 4: Pastor claims UBI (guide 3) ──')
  // The browser still holds the pastor session (Step 1-2). Navigate to guide 3.
  await navAndWait(page, `${base}/en/web3-and-ubi/guide3`, timeout)
  await new Promise(r => setTimeout(r, 4000))

  const hasUbiBtn = await page.evaluate(() =>
    document.body.textContent?.includes('Claim') ||
    document.body.textContent?.includes('Reclamar'))
  if (hasUbiBtn) ok('UBI guide loaded with claim button')
  else console.log('  [!] No UBI claim button text found (may already be claimed today)')

  // ════════════════════════════════════════════════════════════════
  // Step 5: Check profile score + 44 SLEARN bonus
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 5: Score + 44 SLEARN bonus ──')
  const finalProfile = await page.evaluate(async () => {
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const token = localStorage.getItem('learn.tg.authToken') || ''
    const url = `/api/profile?walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(token)}`
    const r = await fetch(url)
    return r.ok ? r.json() : null
  })
  const score = finalProfile?.profilescore ?? 0
  if (score > 90) ok(`Profile score ${score} (> 90 — pastor bonus eligible)`)
  else fail(`Profile score ${score} (expected > 90)`)

  // The 44 SLEARN bonus is awarded on-chain by the verifier/admin flow and
  // depends on the churches fund holding SLEARN. Detect it via the
  // transaction/notification path.
  const txRes = await page.evaluate(async () => {
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const token = localStorage.getItem('learn.tg.authToken') || ''
    const r = await fetch(`/api/user-transactions/${addr}?walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(token)}`)
    return r.ok ? r.json() : null
  })
  const hasBonus = txRes && JSON.stringify(txRes).includes('pastor_bonus')
  if (hasBonus) ok('44 SLEARN pastor bonus recorded')
  else console.log('  [!] No pastor_bonus transaction yet (requires funded churches fund + verifier award step)')

  await browser.close()
  summary(t0)
}

main().catch(e => { console.error(e); process.exit(1) })
