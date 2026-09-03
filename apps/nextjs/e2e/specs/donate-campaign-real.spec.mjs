#!/usr/bin/env node

/**
 * E2E Test: Real donation to a campaign (REQ/223 — Lensenia water well).
 *
 * HTTP + on-chain (no browser). Validates the campaign donation flow:
 *   1. SIWE sign-in (test wallet from apps/.env)
 *   2. Campaign wallet USDT balance BEFORE (on Celo Sepolia)
 *   3. Real on-chain USDT transfer test wallet → backend wallet
 *   4. POST /api/donations/lensenia/verify
 *      Round A: receiveCashback=false, pdjSharePct=0 → 100% reaches the
 *               campaign wallet (auto-forward, immediate)
 *      Round B: receiveCashback=false, pdjSharePct=10 → 90% campaign /
 *               10% pdJ (tesorería del dev = misma billetera del backend)
 *   5. Response: distribution (campaign / pdJ) + campaignForwardHash
 *   6. Campaign wallet balance AFTER: increased by exactly the campaign share
 *   7. /api/user-transactions: donation row with campaign breakdown and NO
 *      donation_reward (cashback desactivado)
 *
 * Prerequisites on the dev server (see doc/e2e-testing.md):
 *   - Campaign engine deployed (donations/[slug]/verify, network-aware)
 *   - NEXT_PUBLIC_USDT_ADDRESS = dev MockUSDT (apps/.env)
 *   - NEXT_PUBLIC_PDJ_TREASURY_ADDRESS set (dev: single wallet)
 *
 * Execution:
 *   node e2e/specs/donate-campaign-real.spec.mjs
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import { SiweMessage } from 'siwe'
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem'
import { celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

for (const p of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env')]) {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false })
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
const CAMPAIGN_SLUG = process.env.CAMPAIGN_SLUG || 'lensenia'
const CAMPAIGN_WALLET = process.env.CAMPAIGN_WALLET || '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07'
const ROUND_A_USDT = Number(process.env.ROUND_A_USDT || '3')
const ROUND_B_USDT = Number(process.env.ROUND_B_USDT || '2')

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

async function rpcRetry(fn, retries = 6) {
  let lastErr
  for (let i = 0; i < retries; i++) {
    try { return await fn() } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 3000)) }
  }
  throw lastErr
}

async function campaignUsdtBalance(client) {
  const raw = await rpcRetry(() => client.readContract({
    address: usdtAddr, abi: erc20Abi, functionName: 'balanceOf', args: [CAMPAIGN_WALLET],
  }))
  return Number(formatUnits(raw, 6))
}

let usdtAddr = ''

async function main() {
  console.log(`E2E: Real donation to campaign "${CAMPAIGN_SLUG}" (REQ/223)\n`)

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  const account = privateKeyToAccount(creds.pk)
  // Backend wallet del dev server (puede diferir del .env local) — mismo truco que donate-gd-real
  let backendWallet = creds.addr
  try {
    const fundRes = await fetch(`${SITE}/api/churches/fund`)
    const fundData = await fundRes.json()
    if (fundData?.address) backendWallet = fundData.address
  } catch { /* keep env fallback */ }
  console.log(`  Backend wallet: ${backendWallet.slice(0, 10)}...`)

  const rpcList = [
    creds.rpc,
    process.env.NEXT_PUBLIC_RPC_URL,
    'https://forno.celo-sepolia.celo-testnet.org',
    'https://celo-sepolia.drpc.org',
    'https://celo-sepolia-rpc.publicnode.com',
  ].filter(Boolean)
  usdtAddr = process.env.NEXT_PUBLIC_USDT_ADDRESS
  console.log(`  USDT (dev Mock): ${usdtAddr}`)
  console.log(`Wallet: ${account.address.slice(0, 10)}... | ${SITE}\n`)

  let publicClient = null
  let walletClient = null
  for (const url of rpcList) {
    try {
      const c = createPublicClient({ chain: celoSepolia, transport: http(url, { timeout: 20000 }) })
      await c.readContract({ address: usdtAddr, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
      publicClient = c
      walletClient = createWalletClient({ account, chain: celoSepolia, transport: http(url, { timeout: 20000 }) })
      console.log(`  Using RPC: ${url}`)
      break
    } catch (e) { console.log(`  RPC ${url} failed: ${(e.shortMessage || e.message || String(e)).slice(0, 100)}`) }
  }
  if (!publicClient) { fail('No working RPC found'); process.exit(1) }

  // ── 0. Campaign wallet balance BEFORE ──
  console.log('── 0. Campaign wallet USDT balance (Celo Sepolia) ──')
  const balanceBefore = await campaignUsdtBalance(publicClient)
  ok(`campaign wallet BEFORE: ${balanceBefore.toFixed(2)} USDT`)

  const donorBal = await publicClient.readContract({ address: usdtAddr, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
  if (Number(formatUnits(donorBal, 6)) < ROUND_A_USDT + ROUND_B_USDT) {
    fail(`Not enough USDT in the test wallet (need ${ROUND_A_USDT + ROUND_B_USDT})`)
    process.exit(1)
  }

  const auth = await siweSignIn(SITE, account)
  if (!auth) { console.log(`\n${passed} passed, ${failed} failed`); process.exit(1) }
  ok('SIWE sign-in OK')
  const headers = { 'Content-Type': 'application/json', ...(auth.cookies ? { Cookie: auth.cookies } : {}) }

  const verifyEndpoint = `${SITE}/api/donations/${CAMPAIGN_SLUG}/verify`

  async function donateRound(amountUsdt, opts, label) {
    console.log(`\n── Round "${label}": ${amountUsdt} USDT (${JSON.stringify(opts)}) ──`)
    const amount = parseUnits(String(amountUsdt), 6)
    const txHash = await rpcRetry(() => walletClient.writeContract({
      address: usdtAddr, abi: erc20Abi, functionName: 'transfer',
      args: [backendWallet, amount],
    }))
    const receipt = await rpcRetry(() => publicClient.waitForTransactionReceipt({ hash: txHash }))
    if (receipt.status === 'success') ok(`USDT transfer confirmed (tx ${txHash.slice(0, 10)}...)`)
    else { fail('USDT transfer failed'); process.exit(1) }

    const res = await fetch(verifyEndpoint, {
      method: 'POST', headers,
      body: JSON.stringify({ walletAddress: account.address, token: auth.token, usdtHash: txHash, ...opts }),
    })
    const body = await res.json()
    if (res.status === 200) ok(`verify: 200 (forward ${(body.hashes?.campaignForwardHash || '').slice(0, 10)}...)`)
    else {
      fail(`verify: ${res.status} ${JSON.stringify(body).slice(0, 250)}`)
      process.exit(1)
    }
    return { amountUsdt, body }
  }

  // ── Round A: 100% a la campaña, sin cashback ──
  const a = await donateRound(ROUND_A_USDT, { receiveCashback: false, pdjSharePct: 0 }, '100% campaign')
  const distA = a.body.distribution || []
  if (distA.some(d => d.destination === 'campaign' && Math.abs(Number(d.amount) - ROUND_A_USDT) < 0.001)) {
    ok(`distribution A: campaign = ${ROUND_A_USDT} USDT (100%)`)
  } else fail(`distribution A inesperada: ${JSON.stringify(distA)}`)
  if (a.body.increment === 0) ok('increment = 0 (cashback OFF)')
  else fail(`increment = ${a.body.increment} (se esperaba 0 con cashback OFF)`)

  // ── Round B: 90% campaña / 10% pdJ ──
  const b = await donateRound(ROUND_B_USDT, { receiveCashback: false, pdjSharePct: 10 }, '90/10 campaign/pdJ')
  const distB = b.body.distribution || []
  const campaignB = Number((distB.find(d => d.destination === 'campaign') || {}).amount || 0)
  const pdjB = Number((distB.find(d => d.destination === 'pdJ') || {}).amount || 0)
  if (Math.abs(campaignB - ROUND_B_USDT * 0.9) < 0.001) ok(`distribution B: campaign = ${campaignB.toFixed(2)} (90% de ${ROUND_B_USDT})`)
  else fail(`distribution B campaign = ${campaignB.toFixed(2)}`)
  if (Math.abs(pdjB - ROUND_B_USDT * 0.1) < 0.001) ok(`distribution B: pdJ = ${pdjB.toFixed(2)} (10%)`)
  else fail(`distribution B pdJ = ${pdjB.toFixed(2)}`)
  if (a.body.hashes?.campaignForwardHash && b.body.hashes?.campaignForwardHash && b.body.hashes?.pdjForwardHash) {
    ok('auto-forward hashes present (campaign A/B + pdJ B)')
  } else fail('missing auto-forward hashes in the responses')

  // ── Campaign wallet AFTER: aumentó exactamente 100% (A) + 90% (B) ──
  console.log('\n── Campaign wallet balance AFTER (auto-forward) ──')
  const expected = ROUND_A_USDT + ROUND_B_USDT * 0.9
  const balanceAfter = await campaignUsdtBalance(publicClient)
  const delta = balanceAfter - balanceBefore
  if (Math.abs(delta - expected) < 0.01) {
    ok(`campaign wallet +${delta.toFixed(2)} USDT (= 100% de ${ROUND_A_USDT} + 90% de ${ROUND_B_USDT})`)
  } else {
    fail(`campaign wallet +${delta.toFixed(2)} USDT, se esperaba +${expected.toFixed(2)}`)
  }

  // ── Ledger rows (user transactions) ──
  console.log('\n── /api/user-transactions ──')
  const userIdRes = await fetch(`${SITE}/api/profile?walletAddress=${encodeURIComponent(account.address)}&token=${encodeURIComponent(auth.token)}`)
  const userProfile = await userIdRes.json()
  if (!userProfile?.id) { fail('Could not get userId') }
  else {
    ok(`userId: ${userProfile.id}`)
    const txsRes = await fetch(`${SITE}/api/user-transactions/${userProfile.id}`)
    const txsData = await txsRes.json()
    const txs = txsData.transactions || []
    const campaignRows = txs.filter(t => (t.descripcion || '').includes('campaign:'))
    if (campaignRows.length >= 2) {
      ok(`donation row(s) with campaign breakdown: ${campaignRows.length}`)
      const hasAmounts = campaignRows.some(d => d.descripcion.includes(`donated: ${ROUND_A_USDT}.00 USDT`)) &&
                         campaignRows.some(d => d.descripcion.includes(`donated: ${ROUND_B_USDT}.00 USDT`))
      if (hasAmounts) ok('descripcion shows both donated amounts')
      else fail('descripcion lacks the donated amounts')
    } else {
      fail(`Expected ≥2 campaign donation rows, got ${campaignRows.length}`)
    }
    const rewardRows = txs.filter(t => t.type === 'donation_reward' && (t.subcategoria === 'campaign' || (t.descripcion || '').includes('campaign')))
    if (rewardRows.length === 0) ok('no donation_reward rows (cashback OFF)')
    else fail(`unexpected donation_reward rows: ${rewardRows.length}`)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
