#!/usr/bin/env node

/**
 * E2E Test: Real donation to a GD country fund — verify success dialog data
 * (distribution from backend response), the recorded transactions, and that
 * the country fund increases by exactly 80% of the donation.
 *
 * Flow:
 *   1. SIWE sign-in (test wallet from apps/.env)
 *   2. Read country fund (Sierra Leona) BEFORE via /api/gdcluster/ranking/funds
 *   3. Real on-chain USDT transfer from test wallet → backend wallet
 *   4. Call /api/gdcluster/donations/verify with countryCode=SL
 *   5. Verify response.distribution = 80% fund / 10% pdJ / 10% cashback (SLEARN),
 *      sums to 100% of the donated value
 *   6. Verify /api/user-transactions/{userId} rows: donation (multiline
 *      descripcion with breakdown) + donation_reward cashback
 *   7. Verify country fund AFTER increased by exactly 80% of the donation
 *      and the SLEARN fund was NOT inflated by the cashback
 *
 * Execution:
 *   node e2e/specs/donate-gd-real.spec.mjs
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import { SiweMessage } from 'siwe'
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem'
import { celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// Load apps/.env (contains contract addresses not present in apps/nextjs/.env)
for (const p of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env')]) {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false })
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
const COUNTRY_CODE = process.env.GD_COUNTRY_CODE || 'SL' // Sierra Leona (pilot)
const DONATION_USDT = 10

let passed = 0
let failed = 0
function ok(msg) { passed++; console.log(`  [OK] ${msg}`) }
function fail(msg) { failed++; console.log(`  [FAIL] ${msg}`) }

const erc20Abi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
]

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
      const rpc = content.match(/NEXT_PUBLIC_RPC_URL="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_RPC_URL=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr, rpc }
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

async function siweSignIn(base, account) {
  let cookies = ''
  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  if (!csrfRes.ok) { fail('CSRF failed'); return null }
  const { csrfToken } = await csrfRes.json()
  const setCookies = csrfRes.headers.getSetCookie?.() || []
  if (setCookies.length) cookies = updateCookies(cookies, setCookies)
  const host = new URL(base).hostname
  const port = new URL(base).port || '443'
  const domainPort = port === '443' || port === '80' ? '' : `:${port}`
  const msg = new SiweMessage({
    domain: `${host}${domainPort}`, address: account.address,
    statement: 'Sign in to Learn through games.',
    uri: base, version: '1', chainId: CHAIN_ID, nonce: csrfToken,
  })
  const msgStr = msg.prepareMessage()
  const sig = await account.signMessage({ message: msgStr })
  const cbBody = new URLSearchParams({
    csrfToken, message: msgStr,
    signature: typeof sig === 'string' ? sig : sig.signature || String(sig),
    redirect: 'false', json: 'true',
  })
  const cbRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cookies ? { Cookie: cookies } : {}) },
    body: cbBody.toString(), redirect: 'manual',
  })
  if (!cbRes.ok) { fail(`SIWE callback: ${cbRes.status}`); return null }
  const cbCookies = cbRes.headers.getSetCookie?.() || []
  if (cbCookies.length) cookies = updateCookies(cookies, cbCookies)
  return { token: csrfToken, cookies }
}

async function rpcRetry(fn, retries = 5) {
  let lastErr
  for (let i = 0; i < retries; i++) {
    try { return await fn() } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 3000)) }
  }
  throw lastErr
}

async function getCountryFund() {
  const res = await fetch(`${SITE}/api/gdcluster/ranking/funds`)
  if (!res.ok) throw new Error(`funds: ${res.status}`)
  const data = await res.json()
  const entry = (data.countries || []).find(c => c.country_code === COUNTRY_CODE)
  return entry
    ? { usdt: Number(entry.usdt_total || 0), slearn: Number(entry.slearn_total || 0) }
    : { usdt: 0, slearn: 0 }
}

async function main() {
  console.log(`E2E: Real donation to GD country fund (${COUNTRY_CODE})\n`)

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  const account = privateKeyToAccount(creds.pk)
  // Backend wallet from the dev server (differs from local .env address)
  let backendWallet = creds.addr
  try {
    const fundRes = await fetch(`${SITE}/api/churches/fund`)
    const fundData = await fundRes.json()
    if (fundData?.address) backendWallet = fundData.address
  } catch { /* keep env fallback */ }
  console.log(`  Backend wallet: ${backendWallet.slice(0, 10)}...`)
  // RPC from apps/.env first, then fallbacks (drpc has the MockUSDT contract;
  // Alchemy public testnet does not)
  const rpcList = [
    creds.rpc,
    process.env.NEXT_PUBLIC_RPC_URL,
    'https://forno.celo-sepolia.celo-testnet.org',
    'https://celo-sepolia.drpc.org',
    'https://celo-sepolia-rpc.publicnode.com',
  ].filter(Boolean)
  const usdtAddr = process.env.NEXT_PUBLIC_USDT_ADDRESS
  console.log(`Wallet: ${account.address.slice(0, 10)}... | ${SITE}\n`)

  // ── 0. Country fund BEFORE ──
  console.log('── 0. Country fund BEFORE ──')
  let fundBefore = { usdt: 0, slearn: 0 }
  try {
    fundBefore = await getCountryFund()
    ok(`fund BEFORE: ${fundBefore.usdt.toFixed(2)} USDT, ${fundBefore.slearn.toFixed(2)} SLEARN`)
  } catch (e) {
    console.log(`  [!] Could not read funds (${e.message}) — will only check the increase`)
  }

  const auth = await siweSignIn(SITE, account)
  if (!auth) { console.log(`\n${passed} passed, ${failed} failed`); process.exit(1) }
  ok('SIWE sign-in OK')

  // Try each RPC until one can actually read the USDT contract
  let publicClient = null
  let walletClient = null
  let usdtBal = null
  for (const url of rpcList) {
    try {
      const c = createPublicClient({ chain: celoSepolia, transport: http(url, { timeout: 20000 }) })
      usdtBal = await c.readContract({ address: usdtAddr, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
      publicClient = c
      walletClient = createWalletClient({ account, chain: celoSepolia, transport: http(url, { timeout: 20000 }) })
      console.log(`  Using RPC: ${url}`)
      break
    } catch (e) { console.log(`  RPC ${url} failed: ${(e.shortMessage || e.message || String(e)).slice(0, 100)}`) }
  }
  if (!publicClient) { fail('No working RPC found'); process.exit(1) }

  // ── 1. Read balances ──
  console.log('\n── 1. Balances ──')
  console.log(`  USDT: ${formatUnits(usdtBal, 6)}`)
  if (usdtBal < parseUnits(String(DONATION_USDT), 6)) { fail(`Not enough USDT (need ${DONATION_USDT})`); process.exit(1) }

  // ── 2. Real on-chain USDT transfer ──
  console.log(`\n── 2. Transfer ${DONATION_USDT} USDT to backend ──`)
  const amount = parseUnits(String(DONATION_USDT), 6)
  const usdtHash = await rpcRetry(() => walletClient.writeContract({
    address: usdtAddr, abi: erc20Abi, functionName: 'transfer',
    args: [backendWallet, amount],
  }))
  const receipt = await rpcRetry(() => publicClient.waitForTransactionReceipt({ hash: usdtHash }))
  if (receipt.status === 'success') ok(`USDT transfer confirmed (tx ${usdtHash.slice(0, 10)}...)`)
  else { fail('USDT transfer failed'); process.exit(1) }

  // ── 3. Call /api/gdcluster/donations/verify ──
  console.log('\n── 3. POST /api/gdcluster/donations/verify ──')
  const res = await fetch(`${SITE}/api/gdcluster/donations/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth.cookies ? { Cookie: auth.cookies } : {}) },
    body: JSON.stringify({
      walletAddress: account.address,
      token: auth.token,
      countryCode: COUNTRY_CODE,
      usdtHash,
    }),
  })
  const body = await res.json()
  if (res.status === 200) ok(`verify: 200 (cashback +${body.increment} SLEARN, process ${(body.txHash || '').slice(0, 10)}...)`)
  else { fail(`verify: ${res.status} ${JSON.stringify(body).slice(0, 200)}`); process.exit(1) }

  // ── 4. Verify distribution (what the success dialog shows) ──
  console.log('\n── 4. Distribution (success dialog data) ──')
  if (Array.isArray(body.distribution) && body.distribution.length > 0) {
    ok(`distribution: ${body.distribution.length} items`)
    for (const d of body.distribution) {
      console.log(`    ${d.destination}: ${Number(d.amount).toFixed(2)} ${d.crypto.toUpperCase()}`)
    }
    const dests = body.distribution.map(d => d.destination)
    if (dests.includes('fund')) ok('fund present (80%)')
    else fail('fund missing from distribution')
    if (dests.includes('pdJ')) ok('pdJ present (10%)')
    else fail('pdJ missing from distribution')
    if (dests.includes('cashback')) ok('cashback present (10% SLEARN)')
    else fail('cashback missing from distribution')

    // Sum check: fund + pdJ = 90% of USDT value; cashback (SLEARN) = 10% in USDT terms
    const fundUsdt = Number((body.distribution.find(d => d.destination === 'fund' && d.crypto === 'usdt') || {}).amount || 0)
    const pdjUsdt = Number((body.distribution.find(d => d.destination === 'pdJ' && d.crypto === 'usdt') || {}).amount || 0)
    const cashbackSlearn = Number((body.distribution.find(d => d.destination === 'cashback') || {}).amount || 0)
    const usdtSum = fundUsdt + pdjUsdt
    const cashbackUsdt = cashbackSlearn / 22 // 1 USDT = 22 SLEARN
    if (Math.abs(usdtSum - DONATION_USDT * 0.9) < 0.001) ok(`fund+pdJ = ${usdtSum.toFixed(2)} USDT (90% of ${DONATION_USDT})`)
    else fail(`fund+pdJ = ${usdtSum.toFixed(2)} USDT, expected ${(DONATION_USDT * 0.9).toFixed(2)}`)
    if (Math.abs(cashbackUsdt - DONATION_USDT * 0.1) < 0.001) ok(`cashback = ${cashbackSlearn.toFixed(2)} SLEARN (10% = ${cashbackUsdt.toFixed(2)} USDT)`)
    else fail(`cashback = ${cashbackSlearn.toFixed(2)} SLEARN, expected ~${(DONATION_USDT * 0.1 * 22).toFixed(2)}`)
    if (Math.abs(usdtSum + cashbackUsdt - DONATION_USDT) < 0.01) ok(`distribution sums to ${DONATION_USDT} USDT (100%)`)
    else fail(`distribution sums to ${(usdtSum + cashbackUsdt).toFixed(2)} USDT, expected ${DONATION_USDT}`)
  } else {
    fail('distribution empty/missing in response')
  }

  // ── 5. Verify user transactions ──
  console.log('\n── 5. /api/user-transactions ──')
  const userIdRes = await fetch(`${SITE}/api/profile?walletAddress=${encodeURIComponent(account.address)}&token=${encodeURIComponent(auth.token)}`)
  const userProfile = await userIdRes.json()
  if (!userProfile?.id) { fail('Could not get userId'); console.log(JSON.stringify(userProfile).slice(0, 200)) }
  else {
    ok(`userId: ${userProfile.id}`)
    const txsRes = await fetch(`${SITE}/api/user-transactions/${userProfile.id}`)
    const txsData = await txsRes.json()
    const txs = txsData.transactions || []
    const donationRows = txs.filter(t => t.descripcion?.includes('donated:'))
    const rewardRows = txs.filter(t => t.type === 'donation_reward')
    if (donationRows.length > 0) {
      ok(`donation row(s): ${donationRows.length}`)
      const d = donationRows[0]
      console.log(`    descripcion:\n${'    ' + (d.descripcion || '').split('\n').join('\n    ')}`)
      const desc = d.descripcion || ''
      if (desc.includes('fund:') && desc.includes('pdJ:') && desc.includes('cashback:')) {
        ok('descripcion shows fund/pdJ/cashback breakdown')
      } else {
        fail('descripcion lacks distribution breakdown')
      }
      if (desc.includes(`donated: ${DONATION_USDT}.00 USDT`)) ok('descripcion shows donated amount')
      else fail(`descripcion lacks "donated: ${DONATION_USDT}.00 USDT"`)
    } else {
      fail('No donation rows found')
    }
    if (rewardRows.length > 0) ok(`donation_reward: ${rewardRows[0].amount} SLEARN`)
    else fail('No donation_reward row')
  }

  // ── 6. Country fund AFTER ──
  console.log('\n── 6. Country fund AFTER ──')
  let fundAfter = { usdt: 0, slearn: 0 }
  try {
    fundAfter = await getCountryFund()
    ok(`fund AFTER: ${fundAfter.usdt.toFixed(2)} USDT, ${fundAfter.slearn.toFixed(2)} SLEARN`)
    const usdtDelta = fundAfter.usdt - fundBefore.usdt
    const expectedDelta = DONATION_USDT * 0.8
    if (Math.abs(usdtDelta - expectedDelta) < 0.01) {
      ok(`USDT fund increased by ${usdtDelta.toFixed(2)} (= 80% of ${DONATION_USDT})`)
    } else {
      fail(`USDT fund increased by ${usdtDelta.toFixed(2)}, expected ${expectedDelta.toFixed(2)}`)
    }
    const slearnDelta = fundAfter.slearn - fundBefore.slearn
    if (Math.abs(slearnDelta) < 0.01) ok(`SLEARN fund unchanged (cashback not counted: ${slearnDelta.toFixed(2)})`)
    else fail(`SLEARN fund changed by ${slearnDelta.toFixed(2)} (should be 0; cashback must be excluded)`)
  } catch (e) {
    console.log(`  [!] Could not read funds after (${e.message})`)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
