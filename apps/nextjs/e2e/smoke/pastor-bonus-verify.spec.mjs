#!/usr/bin/env node

/**
 * Pastor bonus verification smoke test (HTTP).
 *
 * Verifies the admin-side pieces of the 44 SLEARN pastor bonus (REQ #192 +
 * R-#162 notifications):
 *   1. Verifier can list eligible pastors, and all have profile score > 90.
 *   2. GET /api/notifications returns { notifications, unread }.
 *   3. Admin church detail includes `registration_photo`.
 *   4. GET /api/churches/fund returns the churches fund balance.
 *
 * The actual on-chain transfer is exercised manually (requires an eligible
 * pastor + funded Sepolia churches wallet); this test checks the read paths
 * that the bonus flow depends on.
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import axios from 'axios'
import https from 'https'
import { SiweMessage } from 'siwe'
import { privateKeyToAccount } from 'viem/accounts'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const httpsAgent = new https.Agent({ rejectUnauthorized: false })

let passed = 0
let failed = 0
function ok(msg) { passed++; console.log(`  ✅ ${msg}`) }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`) }

function loadEnvCredentials() {
  for (const envPath of [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]) {
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

async function apiGet(path, params, cookies) {
  const url = new URL(path, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.get(url.toString(), { httpsAgent, headers: cookies ? { Cookie: cookies } : {} })
  return res.data
}

async function main() {
  console.log(`Target: ${SITE}\n`)

  const creds = loadEnvCredentials()
  if (!creds) { console.error('[ERROR] No credentials found'); process.exit(1) }
  const { pk, addr } = creds
  console.log(`Wallet: ${addr.slice(0, 6)}...${addr.slice(-4)}`)

  // 1. SIWE + verifier check
  console.log('\n── Test 1: Verifier auth ──')
  let token, cookies
  try {
    const auth = await siweSignIn(pk, addr)
    token = auth.token; cookies = auth.cookies
    ok(`SIWE sign-in OK`)
  } catch (e) {
    fail(`SIWE failed: ${e.message}`)
    console.log(`\n${passed}/${passed + failed} passed — ${failed} failed\n`)
    process.exit(1)
  }

  try {
    const v = await apiGet('/api/admin/check-verifier', { wallet: addr }, cookies)
    if (v.isVerifier) ok('Verifier confirmed')
    else { fail('Not a verifier'); console.log(`\n${passed}/${passed+failed} passed — ${failed} failed\n`); process.exit(1) }
  } catch (e) {
    fail(`Verifier check failed: ${e.message}`)
    process.exit(1)
  }

  // 2. Eligible pastors (score > 90)
  console.log('\n── Test 2: Eligible pastors (profile score > 90) ──')
  try {
    const data = await apiGet('/api/admin/pastor-bonus', { wallet: addr, token }, cookies)
    const pastors = data.pastors || []
    ok(`pastor-bonus endpoint 200 (bonusAmount=${data.bonusAmount})`)
    const below = pastors.filter(p => (p.profilescore ?? 0) <= 90)
    if (below.length === 0) ok(`all ${pastors.length} listed pastors have score > 90`)
    else fail(`${below.length} pastor(s) listed with score <= 90`)
  } catch (e) {
    fail(`pastor-bonus failed: ${e.response?.status || e.message}`)
  }

  // 3. Notifications endpoint
  console.log('\n── Test 3: Notifications endpoint ──')
  try {
    const data = await apiGet('/api/notifications', { walletAddress: addr, token }, cookies)
    if (Array.isArray(data.notifications) && typeof data.unread === 'number') {
      ok(`notifications 200 (${data.notifications.length} total, ${data.unread} unread)`)
    } else {
      fail(`notifications unexpected shape: ${JSON.stringify(data)}`)
    }
  } catch (e) {
    fail(`notifications failed: ${e.response?.status || e.message}`)
  }

  // 4. Churches fund
  console.log('\n── Test 4: Churches fund ──')
  try {
    const data = await apiGet('/api/churches/fund', {}, cookies)
    if (typeof data.slearnBalance !== 'undefined') ok(`fund SLEARN=${data.slearnBalance}`)
    else fail(`fund missing slearnBalance`)
  } catch (e) {
    fail(`fund failed: ${e.response?.status || e.message}`)
  }

  // 5. Admin church detail includes registration_photo
  console.log('\n── Test 5: Admin church detail includes registration_photo ──')
  try {
    const list = await apiGet('/api/admin/churches', { wallet: addr, token }, cookies)
    const churches = list.churches || []
    if (churches.length === 0) {
      ok('no churches to check (skipped)')
    } else {
      const detail = await apiGet(`/api/admin/church/${churches[0].id}`, { wallet: addr, token }, cookies)
      if ('registration_photo' in detail) ok('church detail has registration_photo field')
      else fail('church detail missing registration_photo field')
    }
  } catch (e) {
    fail(`church detail failed: ${e.response?.status || e.message}`)
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
