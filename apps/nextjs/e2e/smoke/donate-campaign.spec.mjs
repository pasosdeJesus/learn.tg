#!/usr/bin/env node

/**
 * Smoke test: Campaign donation endpoints (REQ/223) —
 *   GET  /api/donations/{slug}/balance   (balance multi-cadena)
 *   POST /api/donations/{slug}/verify    (verificación de donación a campaña)
 *
 * HTTP-only, no browser. Validation paths:
 *   - Unknown campaign → 404
 *   - Missing auth fields → 400
 *   - Missing transaction hash → 400
 *   - Bad auth → 401
 *   - pdjSharePct out of bounds → 400
 *   - Balance endpoint returns 200 with the campaign shape
 *
 * Execution:
 *   bin/m test:e2e --smoke donate-campaign
 *   or: node e2e/smoke/donate-campaign.spec.mjs
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { SiweMessage } from 'siwe'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)

let passed = 0
let failed = 0
function ok(msg) { passed++; console.log(`  [OK] ${msg}`) }
function fail(msg) { failed++; console.log(`  [FAIL] ${msg}`) }

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

async function getAuthToken(base, account) {
  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  if (!csrfRes.ok) return null
  const { csrfToken } = await csrfRes.json()
  const host = process.env.IPDES || 'learn.tg'
  const port = process.env.PUERTOPRU || '9001'
  const domainPort = port === '443' || port === '80' ? '' : `:${port}`
  const msg = new SiweMessage({
    domain: `${host}${domainPort}`, address: account.address,
    statement: 'Sign in to Learn through games.',
    uri: base, version: '1', chainId: CHAIN_ID, nonce: csrfToken,
  })
  const sig = await account.signMessage({ message: msg.prepareMessage() })
  const cbBody = new URLSearchParams({
    csrfToken, message: msg.prepareMessage(),
    signature: typeof sig === 'string' ? sig : sig.signature || String(sig),
    redirect: 'false', json: 'true',
  })
  const cbRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cbBody.toString(), redirect: 'manual',
  })
  if (!cbRes.ok) return null
  return { cookie: cbRes.headers.getSetCookie?.()?.map(c => c.split(';')[0]).join('; ') || '', csrfToken }
}

async function main() {
  console.log('Smoke: Campaign donation endpoints (REQ/223)\n')

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  const { privateKeyToAccount } = await import('viem/accounts')
  const account = privateKeyToAccount(creds.pk)
  console.log(`Wallet: ${account.address.slice(0, 10)}... | ${SITE}\n`)

  // ── 0. Balance endpoint (público) ──
  console.log('── 0. GET /api/donations/lensenia/balance ──')
  let r = await fetch(`${SITE}/api/donations/lensenia/balance`)
  if (r.status === 200) {
    const data = await r.json()
    if (data.slug === 'lensenia' && data.goalUSD === 8500 && Array.isArray(data.chains)) ok('balance: 200 with campaign shape')
    else fail('balance: 200 but unexpected shape')
    const chains = data.chains.map(c => c.chain).sort()
    if (JSON.stringify(chains) === JSON.stringify(['avax', 'base', 'celo'])) ok('balance: chains celo/avax/base present')
    else fail(`balance: chains = ${chains.join(',')}`)
    console.log(`    totalUSD=${data.totalUSD} pendingUSD=${data.pendingUSD} chains=${chains.join(',')}`)
  } else {
    fail(`balance: ${r.status} ${(await r.text()).slice(0, 120)}`)
  }

  r = await fetch(`${SITE}/api/donations/nope/balance`)
  if (r.status === 404) ok('Unknown campaign balance → 404')
  else fail(`Unknown campaign balance → ${r.status}`)

  // ── 0b. Movements (breve y completo) ──
  console.log('\n── 0b. GET /api/donations/lensenia/movements (brief + full) ──')
  const brief = await (await fetch(`${SITE}/api/donations/lensenia/movements?limit=8`)).json()
  if (Array.isArray(brief.rows) && brief.rows.length <= 8 && brief.rows.length > 0) ok(`movements brief: ${brief.rows.length} rows (<=8)`)
  else fail(`movements brief: ${JSON.stringify(brief).slice(0, 160)}`)
  const full = await (await fetch(`${SITE}/api/donations/lensenia/movements?limit=300`)).json()
  if (Array.isArray(full.rows) && full.rows.length >= brief.rows.length) ok(`movements full: ${full.rows.length} rows (>= brief ${brief.rows.length})`)
  else fail(`movements full: ${JSON.stringify(full).slice(0, 160)}`)
  const mRow = full.rows[0]
  if (mRow && typeof mRow.direction === 'string' && mRow.hash) ok(`movements row: ${mRow.ts?.slice(0, 10)} ${mRow.direction} ${mRow.token || mRow.kind} (${mRow.hash.slice(0, 10)}…)`)
  else fail('movements: first row malformed')

  const mBrief = await fetch(`${SITE}/en/donations/lensenia`)
  const mBriefHtml = await mBrief.text()
  if (mBrief.status === 200 && mBriefHtml.includes('Recent movements of the campaign wallet')) ok('donation page shows recent movements section')
  else fail('donation page does not show recent movements')
  const mFullPage = await fetch(`${SITE}/en/donations/lensenia/movements`)
  const mFullHtml = await mFullPage.text()
  if (mFullPage.status === 200 && mFullHtml.includes('Movement history')) ok('full movements page renders')
  else fail('full movements page missing')

  // ── 1. Unknown campaign on verify → 404 (sin auth) ──
  console.log('\n── 1. POST /api/donations/{slug}/verify validation ──')
  r = await fetch(`${SITE}/api/donations/nope/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })
  if (r.status === 404) ok('Unknown campaign verify → 404')
  else fail(`Unknown campaign verify → ${r.status}`)

  // Empty body → 400 (missing auth fields, checked before auth)
  r = await fetch(`${SITE}/api/donations/lensenia/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })
  if (r.status === 400) ok('Empty body → 400 (missing auth fields)')
  else fail(`Empty body → ${r.status}`)

  // ── 2. SIWE auth + remaining validations ──
  const auth = await getAuthToken(SITE, account)
  if (!auth) { console.log('Auth failed'); process.exit(1) }
  ok('SIWE sign-in OK')
  const headers = { Cookie: auth.cookie, 'Content-Type': 'application/json' }
  const wallet = account.address
  const token = auth.csrfToken

  r = await fetch(`${SITE}/api/donations/lensenia/verify`, {
    method: 'POST', headers,
    body: JSON.stringify({ walletAddress: wallet, token }),
  })
  if (r.status === 400) ok('Missing tx hash → 400')
  else fail(`Missing tx hash → ${r.status}`)

  r = await fetch(`${SITE}/api/donations/lensenia/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: '0x0000000000000000000000000000000000000000', token: 'bad',
      usdtHash: '0x' + 'ab'.repeat(32),
    }),
  })
  if (r.status === 401) ok('Bad wallet/token → 401')
  else fail(`Bad wallet/token → ${r.status}`)

  r = await fetch(`${SITE}/api/donations/lensenia/verify`, {
    method: 'POST', headers,
    body: JSON.stringify({ walletAddress: wallet, token, usdtHash: '0x' + 'ab'.repeat(32), pdjSharePct: 150 }),
  })
  if (r.status === 400) ok('pdjSharePct out of bounds → 400')
  else fail(`pdjSharePct out of bounds → ${r.status}`)

  // Real on-chain donation is covered by e2e/specs/donate-campaign-real.spec.mjs
  console.log('\n  [SKIP] Real on-chain donation → donate-campaign-real.spec.mjs')

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
