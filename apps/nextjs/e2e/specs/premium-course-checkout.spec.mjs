// E2E Test: Premium course checkout UI
// Verifies that a premium course (GD) shows a "Buy this course" button and
// opens the CheckoutModal with the price.
//
// Uses a fresh pastor wallet made eligible via the API (Sierra Leone profile
// + verifier confirmation of the worship location), so the Buy button is
// always shown regardless of what the fixture wallet has purchased.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     node e2e/specs/premium-course-checkout.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import axios from 'axios'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from 'viem/accounts'
import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary, short,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

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

async function siweSignIn(privateKey, address) {
  const account = privateKeyToAccount(privateKey)
  const csrfRes = await axios.get(`${SITE}/api/auth/csrf`, { httpsAgent })
  const csrfToken = csrfRes.data.csrfToken
  let cookies = ''
  if (csrfRes.headers['set-cookie']) cookies = updateCookies(cookies, csrfRes.headers['set-cookie'])
  const siweMessage = new SiweMessage({
    domain: new URL(SITE).host, address,
    statement: 'Sign in to Learn through games with DIVVI tracking.',
    uri: SITE, version: '1', chainId: CHAIN_ID, nonce: csrfToken,
    issuedAt: new Date().toISOString(),
  })
  const message = siweMessage.prepareMessage()
  const signature = await account.signMessage({ message })
  const fd = new URLSearchParams({ csrfToken, message, signature, redirect: 'false', callbackUrl: `${SITE}/`, json: 'true' })
  const res = await axios.post(`${SITE}/api/auth/callback/credentials`, fd.toString(), {
    httpsAgent, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    maxRedirects: 0, validateStatus: s => s < 400,
  })
  if (res.headers['set-cookie']) cookies = updateCookies(cookies, res.headers['set-cookie'])
  return { token: csrfToken, cookies, address }
}

async function apiPatch(pathname, body, params, cookies) {
  const url = new URL(pathname, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.patch(url.toString(), body, {
    httpsAgent, headers: { 'Content-Type': 'application/json', ...(cookies ? { Cookie: cookies } : {}) },
  })
  return res.data
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  const verifier = loadEnvCredentials()
  if (!verifier) { console.error('No verifier credentials'); process.exit(1) }
  const env = await initTestEnv()
  const { base, timeout, chainId } = env

  // 1. Fresh eligible pastor wallet
  const pk = generatePrivateKey()
  const addr = privateKeyToAddress(pk)
  const testEmail = `checkout-${addr.slice(2, 10).toLowerCase()}@learn.tg`
  console.log(`Pastor: ${short(addr)} | ${base}`)

  // 2. Fill Sierra Leone profile (Christian, pilot country, non-Zionist)
  const s = await siweSignIn(pk, addr)
  const auth = { walletAddress: addr, token: s.token }
  await apiPatch('/api/profile', {
    nombre: 'E2E Checkout', email: testEmail, pais_id: 694, religion_id: 2,
    position_israel_gaza: 'no', place_of_worship: 'E2E Checkout Church',
    place_of_worship_location: 'Freetown', church_relationship: 'pastor',
  }, auth)

  // 3. Verifier confirms the worship location → eligible to buy GD
  const vAuth = await siweSignIn(verifier.pk, verifier.addr)
  const profile = await axios.get(`${SITE}/api/profile?walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(s.token)}`, { httpsAgent }).then(r => r.data)
  await apiPatch(`/api/admin/user/${profile.id}`, {
    verified_place_of_worship_location: 'Freetown',
    verified_place_of_worship: 'E2E Checkout Church',
    verified_church_relationship: 'pastor',
  }, { wallet: verifier.addr, token: vAuth.token }, vAuth.cookies)

  // 4. Browser: Buy button + CheckoutModal
  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, addr, timeout)
  await setupE2EAuth(page, addr, pk, chainId, base)
  await page.goto(`${base}/en/gdcluster`, { waitUntil: 'domcontentloaded', timeout })

  // Wait for the course page to finish loading (cold on-demand compilation can
  // leave "Loading course..." up for a while in the full suite).
  let state = null
  for (let i = 0; i < 30 && !state; i++) {
    await new Promise(r => setTimeout(r, 1500))
    state = await page.evaluate(() => {
      const txt = document.body.innerText || ''
      if (txt.includes('Buy this course')) return 'buy'
      if (txt.includes('Purchased') || txt.includes('Comprado')) return 'purchased'
      if (txt.includes('Loading course') || txt.includes('Cargando curso')) return null
      // eligibility reason shown instead of Buy
      if (txt.includes('requires a verified city') || txt.includes('ciudad de culto verificada') ||
          txt.includes('Not eligible') || txt.includes('No cumples') || txt.includes('for Christians') ||
          txt.includes('para cristianos') || txt.includes('pilot') || txt.includes('país piloto')) return 'reason'
      return null
    })
  }
  console.log('  [course state] ' + state)

  const buyVisible = state === 'buy' || await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, span'))
    return btns.some(b => (b.textContent || '').includes('Buy this course'))
  })
  if (buyVisible) ok('Buy button visible')
  else {
    fail('Buy button not visible on premium course page (state: ' + state + ')')
    const dump = await page.evaluate(() => (document.body.innerText || '').slice(0, 400))
    console.log('  [page dump] ' + JSON.stringify(dump))
  }

  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const btn = buttons.find((b) => (b.textContent || '').includes('Buy this course'))
    if (btn) { btn.click(); return true }
    return false
  })
  if (clicked) ok('Buy button clicked')
  else fail('Buy button not found/clickable')

  // Checkout modal opened
  let modalVisible = false
  for (let i = 0; i < 12 && !modalVisible; i++) {
    await new Promise(r => setTimeout(r, 1000))
    modalVisible = await page.evaluate(() =>
      (document.body.textContent || '').includes('Purchase course') ||
      (document.body.textContent || '').includes('Comprar curso'))
  }
  if (modalVisible) ok('Checkout modal opened')
  else fail('Checkout modal did not open')

  // Slider (USDT/SLEARN split) present and functional
  const sliderInfo = await page.evaluate(() => {
    const range = document.querySelector('input[type="range"]')
    if (!range) return null
    const before = range.value
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(range, '100')
    range.dispatchEvent(new Event('input', { bubbles: true }))
    range.dispatchEvent(new Event('change', { bubbles: true }))
    return { before, after: range.value, min: range.min, max: range.max }
  })
  if (sliderInfo) ok(`Slider present (${sliderInfo.min}–${sliderInfo.max}, moved ${sliderInfo.before}→${sliderInfo.after})`)
  else fail('Slider not found in modal')

  await browser.close()
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\n${summary.failures} failures | ${elapsed}s`)
  if (summary.failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
