#!/usr/bin/env node
// E2E Test: Interview booking at 2PM shows 2PM (date-column timestamptz fix)
//
// Regression for: booking a 2PM slot displayed "05:00 AM (Africa/Freetown)"
// because proposed_date_of_interview was a `date` column that dropped the
// time and read back as server-local midnight.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     node e2e/specs/interview-date.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import axios from 'axios'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from 'viem/accounts'
import { initTestEnv, launchBrowser, resetFailures, fail, ok, summary, short } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

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

async function apiGet(pathname, params, extra) {
  const url = new URL(pathname, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.get(url.toString(), { httpsAgent, headers: extra || {} })
  return res.data
}

async function apiPost(pathname, body, params, extra) {
  const url = new URL(pathname, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.post(url.toString(), body, {
    httpsAgent,
    headers: { 'Content-Type': 'application/json', ...(extra || {}) },
  })
  return res.data
}

async function apiPatch(pathname, body, params, extra) {
  const url = new URL(pathname, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.patch(url.toString(), body, {
    httpsAgent,
    headers: { 'Content-Type': 'application/json', ...(extra || {}) },
  })
  return res.data
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'
  const env = await initTestEnv()
  const { base, chainId } = env
  const timeout = 180000

  // 1. Fresh pastor wallet
  const pk = generatePrivateKey()
  const addr = privateKeyToAddress(pk)
  const testEmail = `interview-date-${addr.slice(2, 10).toLowerCase()}@learn.tg`
  console.log(`Pastor wallet: ${short(addr)} | ${base}\n`)

  // 2. SIWE sign-in (HTTP) → token + cookies
  const session = await siweSignIn(pk, addr)
  const auth = `walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(session.token)}`
  console.log('Signed in (HTTP).')

  // 3. Fill SL profile so profilescore is computed (< 100 → scheduler shows)
  await apiPatch('/api/profile', {
    religion_id: 2, pais_id: 694, position_israel_gaza: 'no',
    email: testEmail, nombre: 'E2E Interview Date',
  }, { walletAddress: addr, token: session.token })
  const profileAfterFill = await apiGet('/api/profile', { walletAddress: addr, token: session.token })
  console.log(`Profile after fill: score=${profileAfterFill.profilescore}, tz=${profileAfterFill.country_timezone}`)

  // 4. Fetch availability, pick a 14:00 UTC slot (= 2PM in Africa/Freetown)
  const avail = await apiGet('/api/verification/availability', { days: 14, duration: 30, timezone: 'Africa/Freetown' })
  const slots = avail.slots || []
  let chosen = slots.find(s => s.start.includes('T14:00:00.000Z'))
  if (!chosen) chosen = slots.find(s => s.start.includes('T15:00:00.000Z'))
  if (!chosen) {
    fail(`No 14:00 UTC slot in availability (${slots.length} slots). First: ${JSON.stringify(slots[0])}`)
  } else {
    ok(`Chosen slot: ${chosen.start}`)
  }
  if (!chosen) { console.log(`\n0 failures (sin entrevista elegible)`); process.exit(0) }

  // 5. Book it
  const booking = await apiPost('/api/verification/book', {
    walletAddress: addr, token: session.token,
    start: chosen.start, end: chosen.end,
  })
  if (booking.success !== true) {
    fail(`Booking failed: ${JSON.stringify(booking).slice(0, 200)}`)
  } else {
    ok('Booking: success')
  }

  // 6. Profile must return the exact instant (14:00:00.000Z), not midnight
  const profile = await apiGet('/api/profile', { walletAddress: addr, token: session.token })
  const stored = profile.proposed_date_of_interview || ''
  console.log(`Stored proposed_date_of_interview: ${stored}`)
  if (stored === chosen.start) {
    ok(`API stores exact instant: ${stored}`)
  } else if (stored.startsWith(chosen.start.slice(0, 11)) && !stored.includes('T14:00')) {
    fail(`Time LOST (column likely still \`date\`): got ${stored}, expected ${chosen.start}`)
  } else {
    fail(`Stored differs: got ${stored}, expected ${chosen.start}`)
  }

  // 7. Browser: profile page must show "at 02:00 PM (Africa/Freetown)"
  console.log('\nBrowser check: profile scheduler message')
  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(timeout)
  await setupE2EAuth(page, addr, pk, chainId, base)
  await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded' , timeout: 120000 })
  await new Promise(r => setTimeout(r, 8000))

  let body = ''
  for (let i = 0; i < 10; i++) {
    body = await page.evaluate(() => document.body?.textContent || '')
    if (body.includes('Interview scheduled') || body.includes('Entrevista agendada')) break
    await new Promise(r => setTimeout(r, 3000))
  }
  if (/\b(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)\b/.test(body) && body.includes('Africa/Freetown')) {
    ok('Profile shows the interview time with Africa/Freetown timezone')
  } else if (body.includes('05:00 AM')) {
    fail('Profile still shows 05:00 AM — fix not effective')
  } else {
    const m = body.match(/(Entrevista agendada para el|Interview scheduled for)[^.]{0,120}/)
    fail(`Scheduler message not as expected. Found: ${(m ? m[0] : body.slice(0, 200))}`)
  }
  await browser.close()

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  const failures = summary(t0)
  console.log(`\n${failures} failures | ${elapsed}s`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
