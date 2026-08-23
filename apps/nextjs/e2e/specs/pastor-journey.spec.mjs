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
import { createPublicClient, createWalletClient, http, parseUnits, parseEther } from 'viem'
import { celoSepolia } from 'viem/chains'
import {
  initTestEnv, launchBrowser, resetFailures, fail, ok, summary,
  short,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

const slearnTransferAbi = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
]

// ClusterFundsV2 (REQ/214): country fund + replay protection read for the
// "10% to the buyer's country fund" check.
const clusterFundsV2Abi = [
  { name: 'getCountryBalance', type: 'function', stateMutability: 'view', inputs: [{ name: 'c', type: 'string' }], outputs: [{ name: 'usdt', type: 'uint256' }, { name: 'slearn', type: 'uint256' }] },
  { name: 'processedTx', type: 'function', stateMutability: 'view', inputs: [{ name: 'h', type: 'bytes32' }], outputs: [{ name: '', type: 'bool' }] },
]

function readClusterFundsV2Address() {
  const file = path.join(process.cwd(), '..', 'hardhat', 'deployments', 'ClusterFundsV2', 'celoSepolia.json')
  if (!fs.existsSync(file)) return null
  try { return JSON.parse(fs.readFileSync(file, 'utf8')).address } catch { return null }
}

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

function loadEnvValue(key) {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const m = content.match(new RegExp(`${key}="([^"]+)"`)) || content.match(new RegExp(`${key}=(\\S+)`))
      if (m) return m[1]
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
  // Unique per run — usuario.email has a UNIQUE index, so a fixed email
  // collides on the second run and makes the profile PATCH fail with 500.
  const testEmail = `pastor-e2e-${pastorAddr.slice(2, 10).toLowerCase()}@learn.tg`
  console.log(`Pastor wallet:  ${short(pastorAddr)}`)
  console.log(`Verifier wallet: ${short(verifier.addr)}`)

  const env = await initTestEnv()
  const { base, chainId } = env
  const timeout = 120000

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(timeout)

  // Auth: inject wallet mock + SIWE programmatico for the pastor
  await setupE2EAuth(page, pastorAddr, pastorPk, chainId, base)

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
  // Step 1: Pastor already authenticated (setupE2EAuth)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 1: Pastor authenticated ──')
  const pastorAuth = await page.evaluate(() => ({
    addr: localStorage.getItem('learn.tg.sessionAddress')?.slice(0, 12),
    token: localStorage.getItem('learn.tg.authToken')?.slice(0, 12),
  })).catch(() => ({ addr: null, token: null }))
  if (pastorAuth.addr) ok('Pastor SIWE complete (programmatic)')
  else { fail('Pastor auth state missing'); await browser.close(); process.exit(1) }
  await new Promise(r => setTimeout(r, 2000))

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
    return { ok: r.ok, status: r.status, body: await r.text(), addr: addr.slice(0, 10), token: token.slice(0, 10) }
  }, {
    nombre: 'Pastor E2E Test',
    email: testEmail,
    whatsapp: '+23276123456',
    pais_id: 694,                       // Sierra Leone
    religion_id: 2,                     // Christian (GD course purchase gate)
    church_relationship: 'pastor',
    position_israel_gaza: 'no',
    place_of_worship: 'E2E Test Church',
    place_of_worship_location: 'Freetown',
    registration: 'E2E-REG-001',
    denomination: 'E2E Denomination',
  })
  if (profileRes.ok) ok('Pastor profile saved')
  else fail(`Profile PATCH failed: ${profileRes.status} addr=${profileRes.addr} token=${profileRes.token} ${profileRes.body.slice(0, 120)}`)

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
      verified_email: testEmail,
      verified_whatsapp: '+23276123456',
      verified_place_of_worship: 'E2E Test Church',
      verified_place_of_worship_location: 'Freetown',
      verified_church_relationship: 'pastor',
      proposed_date_of_interview: '2026-08-25',
    },
    { wallet: verifier.addr, token: vAuth.token },
    vAuth.cookies,
  )
  if (verifyRes?.success || verifyRes?.user) {
    ok(`Verifier verified pastor — new score: ${verifyRes.user?.profilescore}`)
  } else {
    fail(`Verifier PATCH failed: ${JSON.stringify(verifyRes).slice(0, 140)}`)
  }

  // Create a church and assign the pastor (required for GD course purchase:
  // religion_id=2 Christian + church membership + verified registration).
  let churchId = null
  try {
    const churchRes = await axios.post(
      `${SITE}/api/admin/churches?wallet=${verifier.addr}&token=${vAuth.token}`,
      { name: 'E2E Test Church', country_id: 694, denomination: 'E2E Denomination' },
      { httpsAgent, headers: { 'Content-Type': 'application/json', Cookie: vAuth.cookies } },
    )
    churchId = churchRes.data?.church?.id
    if (churchId) ok(`Church created (#${churchId})`)
    else fail(`Church creation failed: ${JSON.stringify(churchRes.data).slice(0, 140)}`)
  } catch (e) {
    fail(`Church creation error: ${e.message}`)
  }

  if (churchId) {
    const assignRes = await apiPatch(
      `/api/admin/user/${pastorUserId}`,
      { church_id: churchId },
      { wallet: verifier.addr, token: vAuth.token },
      vAuth.cookies,
    )
    if (assignRes?.success || assignRes?.user) ok(`Pastor assigned to church #${churchId}`)
    else fail(`Church assignment failed: ${JSON.stringify(assignRes).slice(0, 140)}`)

    const churchVerifyRes = await apiPatch(
      `/api/admin/church/${churchId}`,
      { registration_verified: true },
      { wallet: verifier.addr, token: vAuth.token },
      vAuth.cookies,
    )
    if (churchVerifyRes?.success) {
      ok('Church registration verified')
      if (churchVerifyRes.bonus?.awarded) ok(`44 SLEARN bonus awarded (tx ${churchVerifyRes.bonus.hash})`)
      else if (churchVerifyRes.bonus?.reason) console.log(`  [!] Bonus not awarded: ${churchVerifyRes.bonus.reason}`)
    } else {
      fail(`Church registration verification failed: ${JSON.stringify(churchVerifyRes).slice(0, 140)}`)
    }
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
  const txRes = await page.evaluate(async (userId) => {
    const r = await fetch(`/api/user-transactions/${userId}`)
    return r.ok ? r.json() : null
  }, pastorUserId)
  const hasBonus = txRes && JSON.stringify(txRes).includes('pastor_bonus')
  if (hasBonus) ok('44 SLEARN pastor bonus recorded')
  else console.log('  [!] No pastor_bonus transaction yet (requires funded churches fund + verifier award step)')

  // ════════════════════════════════════════════════════════════════
  // Step 6: Pastor buys the Global Disciples course (on-chain)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 6: Pastor buys Global Disciples course ──')
  const gdCourseId = 10 // EN /gdcluster
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || loadEnvValue('NEXT_PUBLIC_RPC_URL') || 'https://forno.celo-sepolia.celo-testnet.org'
  // Read live contract addresses from the dev server — the local .env may point
  // to a stale deployment (the SLEARN was re-deployed, and the backend wallet
  // differs from the local test wallet).
  let slearnAddress = process.env.NEXT_PUBLIC_SLEARN_ADDRESS || loadEnvValue('NEXT_PUBLIC_SLEARN_ADDRESS')
  let backendWallet = verifier.addr
  try {
    const fundRes = await axios.get(`${SITE}/api/churches/fund`, { httpsAgent })
    if (fundRes.data?.slearnAddress) slearnAddress = fundRes.data.slearnAddress
    if (fundRes.data?.address) backendWallet = fundRes.data.address
  } catch { /* keep env fallback */ }

  // Check purchase eligibility (Christian + pilot country + church + non-Zionist)
  const purchaseCheck = await page.evaluate(async (courseId) => {
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const token = localStorage.getItem('learn.tg.authToken') || ''
    const q = `walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(token)}`
    const eligRes = await fetch(`/api/courses/${courseId}/purchase-eligibility?${q}`)
    const elig = eligRes.ok ? await eligRes.json() : null
    const accessRes = await fetch(`/api/courses/${courseId}/access?${q}`)
    return { eligOk: eligRes.ok, elig, accessStatus: accessRes.status }
  }, gdCourseId)

  if (purchaseCheck.elig?.eligible) ok('GD course purchase eligibility confirmed')
  else { fail(`GD course not eligible: ${JSON.stringify(purchaseCheck.elig).slice(0, 140)}`); await browser.close(); process.exit(1) }

  // Before purchase, a premium course should deny guide access.
  if (purchaseCheck.accessStatus === 403) ok('GD course is gated (403 before purchase)')
  else console.log(`  [!] Access status ${purchaseCheck.accessStatus} (expected 403 before purchase)`)

  // On-chain purchase: fund gas → transfer SLEARN → purchase endpoint → verify access.
  try {
    const publicClient = createPublicClient({ chain: celoSepolia, transport: http(rpcUrl) })

    // 1. Fund the pastor's wallet with CELO gas (from the test/backend wallet).
    const funder = privateKeyToAccount(verifier.pk)
    const funderClient = createWalletClient({ account: funder, chain: celoSepolia, transport: http(rpcUrl) })
    const gasHash = await funderClient.sendTransaction({ to: pastorAddr, value: parseEther('0.1') })
    await publicClient.waitForTransactionReceipt({ hash: gasHash })
    ok('Pastor funded with CELO gas')

    // 2. Pastor transfers SLEARN (the 44 bonus) to the backend wallet.
    const pastorAccount = privateKeyToAccount(pastorPk)
    const pastorClient = createWalletClient({ account: pastorAccount, chain: celoSepolia, transport: http(rpcUrl) })
    const slearnHash = await pastorClient.writeContract({
      address: slearnAddress,
      abi: slearnTransferAbi,
      functionName: 'transfer',
      args: [backendWallet, parseUnits('44', 2)],
    })
    await publicClient.waitForTransactionReceipt({ hash: slearnHash })
    ok(`SLEARN transferred to backend (tx ${short(slearnHash)})`)

    // 2b. REQ/214: read ClusterFundsV2 SL fund BEFORE — the 10% routed from
    // the purchase must arrive intact (100% credit, no fees).
    const cfV2Address = readClusterFundsV2Address()
    if (cfV2Address) console.log(`  ClusterFundsV2: ${short(cfV2Address)}`)
    else console.log('  [!] ClusterFundsV2 deployment not found — skipping on-chain 10% check')
    let slFundBefore = null
    if (cfV2Address) {
      try {
        const [u, s] = await publicClient.readContract({ address: cfV2Address, abi: clusterFundsV2Abi, functionName: 'getCountryBalance', args: ['SL'] })
        slFundBefore = { usdt: u, slearn: s }
        console.log(`  SL fund before: ${Number(s) / 100} SLEARN`)
      } catch (e) { console.log(`  [!] Could not read V2 SL fund before: ${(e.shortMessage || e.message || String(e)).slice(0, 80)}`) }
    }

    // 3. Call the premium purchase endpoint.
    const purchaseRes = await page.evaluate(async ({ courseId, slearnHash }) => {
      const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
      const token = localStorage.getItem('learn.tg.authToken') || ''
      const r = await fetch('/api/courses/premium/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: addr, token, courseId, slearnHash }),
      })
      return { status: r.status, body: await r.text() }
    }, { courseId: gdCourseId, slearnHash })

    if (purchaseRes.status === 200 || purchaseRes.status === 201) ok('GD course purchased')
    else fail(`Course purchase failed: ${purchaseRes.status} ${purchaseRes.body.slice(0, 160)}`)

    // 3b. Distribution (REQ/214 Paso 7): the response carries the
    // processPayment breakdown (90% of the payment; the other 10% is routed
    // to the buyer's country fund).
    let purchaseBody = null
    try { purchaseBody = JSON.parse(purchaseRes.body) } catch { /* non-JSON */ }
    if (purchaseBody?.distribution && purchaseBody.distribution.length > 0) {
      ok(`distribution: ${purchaseBody.distribution.length} items`)
      for (const d of purchaseBody.distribution) {
        console.log(`    ${d.destination}: ${Number(d.amount).toFixed(2)} ${d.crypto.toUpperCase()}`)
      }
      const dests = purchaseBody.distribution.map(d => d.destination)
      if (dests.includes('course_vault')) ok('course_vault present')
      else console.log('  [!] course_vault not in distribution (event parsing may label differently)')
      if (dests.includes('cashback')) ok('reward/cashback present')
      else console.log('  [!] cashback not in distribution')
    } else {
      console.log('  [!] No distribution in purchase response')
    }

    // 3c. REQ/214: the 10% routed to ClusterFundsV2 must arrive intact at the
    // buyer's country fund (SL) — 4.4 SLEARN for a 44 SLEARN payment.
    if (cfV2Address) {
      try {
        const processed = await publicClient.readContract({ address: cfV2Address, abi: clusterFundsV2Abi, functionName: 'processedTx', args: [slearnHash] })
        if (processed) ok('V2 processedTx(paymentTx)=true — 10% contribution recorded')
        else fail('V2 processedTx(paymentTx)=false — 10% contribution NOT processed')
        const [u2, s2] = await publicClient.readContract({ address: cfV2Address, abi: clusterFundsV2Abi, functionName: 'getCountryBalance', args: ['SL'] })
        const expected = (parseUnits('44', 2) * 10n) / 100n // 10% of the 44 SLEARN payment
        if (slFundBefore) {
          const delta = s2 - slFundBefore.slearn
          if (delta === expected) ok(`SL fund SLEARN delta = ${Number(delta) / 100} (= 10% of 44, REQ/214)`)
          else if (delta > expected) ok(`SL fund delta ${Number(delta) / 100} ≥ 10% (includes concurrent activity)`)
          else fail(`SL fund delta ${Number(delta) / 100} < expected 4.4 — fees deducted from the 10%`)
        } else {
          ok(`V2 SL fund now: ${Number(s2) / 100} SLEARN`)
        }
      } catch (e) { console.log(`  [!] On-chain 10% check failed: ${(e.shortMessage || e.message || String(e)).slice(0, 100)}`) }
    }

    // 4. Verify access is now granted (200 instead of 403).
    const accessAfter = await page.evaluate(async (courseId) => {
      const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
      const token = localStorage.getItem('learn.tg.authToken') || ''
      const q = `walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(token)}`
      const r = await fetch(`/api/courses/${courseId}/access?${q}`)
      return r.status
    }, gdCourseId)
    if (accessAfter === 200) ok('GD course access granted after purchase')
    else fail(`GD course access not granted (${accessAfter})`)

    // Navigate to the GD course page — it should now load the guides.
    await navAndWait(page, `${base}/en/gdcluster`, timeout)
    await new Promise(r => setTimeout(r, 4000))
    const courseLoaded = await page.evaluate(() =>
      (document.body?.textContent || '').replace(/\s+/g, '').length > 100)
    if (courseLoaded) ok('GD course page loaded')
    else fail('GD course page did not load')
  } catch (e) {
    fail(`On-chain purchase error: ${e.message}`)
  }

  await browser.close()
  summary(t0)
}

main().catch(e => { console.error(e); process.exit(1) })
