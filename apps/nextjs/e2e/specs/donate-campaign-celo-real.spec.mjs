#!/usr/bin/env node

/**
 * E2E Test: Real donation to a campaign in NATIVE CELO (REQ/223) on the dev
 * site (Celo Sepolia). Validates the native flow:
 *   1. SIWE sign-in (test wallet from apps/.env)
 *   2. Campaign wallet CELO balance BEFORE
 *   3. Real on-chain native CELO send test wallet → backend wallet
 *   4. POST /api/donations/lensenia/verify with payToken='celo'
 *      Round A: 100% campaign | Round B: 90% campaign / 10% pdJ
 *   5. Response: distribution in CELO + campaignForwardHash
 *   6. Campaign wallet CELO balance AFTER: increased by the campaign share
 *   7. /api/user-transactions: donation row crypto=celo, no donation_reward
 *
 * Execution:
 *   node e2e/specs/donate-campaign-celo-real.spec.mjs
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import { SiweMessage } from 'siwe'
import { createPublicClient, createWalletClient, http, parseUnits, formatEther } from 'viem'
import { celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

for (const p of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env')]) {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false })
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
const CAMPAIGN_WALLET = process.env.CAMPAIGN_WALLET || '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07'
const ROUND_A = parseUnits(process.env.ROUND_A_CELO || '0.5', 18)
const ROUND_B = parseUnits(process.env.ROUND_B_CELO || '0.4', 18)

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

async function campaignCeloBalance(client) {
  return rpcRetry(() => client.getBalance({ address: CAMPAIGN_WALLET }))
}

async function main() {
  console.log('E2E: Real campaign donation in NATIVE CELO (REQ/223) — dev (Celo Sepolia)\n')

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  const account = privateKeyToAccount(creds.pk)
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

  let publicClient = null
  let walletClient = null
  for (const url of rpcList) {
    try {
      const c = createPublicClient({ chain: celoSepolia, transport: http(url, { timeout: 20000 }) })
      await c.getBalance({ address: account.address })
      publicClient = c
      walletClient = createWalletClient({ account, chain: celoSepolia, transport: http(url, { timeout: 20000 }) })
      console.log(`  Using RPC: ${url}`)
      break
    } catch (e) { console.log(`  RPC ${url} failed: ${(e.shortMessage || e.message || String(e)).slice(0, 100)}`) }
  }
  if (!publicClient) { fail('No working RPC found'); process.exit(1) }

  console.log(`Wallet: ${account.address.slice(0, 10)}... | ${SITE}\n`)

  const donorBal = await publicClient.getBalance({ address: account.address })
  if (donorBal < ROUND_A + ROUND_B + parseUnits('0.2', 18)) {
    fail('Not enough CELO in the test wallet (gas + donation)')
    process.exit(1)
  }

  console.log('── 0. Campaign wallet CELO balance (Celo Sepolia) ──')
  const balanceBefore = await campaignCeloBalance(publicClient)
  ok(`campaign wallet BEFORE: ${formatEther(balanceBefore)} CELO`)

  const auth = await siweSignIn(SITE, account)
  if (!auth) { console.log(`\n${passed} passed, ${failed} failed`); process.exit(1) }
  ok('SIWE sign-in OK')
  const headers = { 'Content-Type': 'application/json', ...(auth.cookies ? { Cookie: auth.cookies } : {}) }
  const verifyEndpoint = `${SITE}/api/donations/lensenia/verify`

  async function donateRound(value, opts, label) {
    console.log(`\n── Round "${label}": ${formatEther(value)} CELO (${JSON.stringify(opts)}) ──`)
    const txHash = await rpcRetry(() => walletClient.sendTransaction({ to: backendWallet, value }))
    const receipt = await rpcRetry(() => publicClient.waitForTransactionReceipt({ hash: txHash }))
    if (receipt.status === 'success') ok(`CELO send confirmed (tx ${txHash.slice(0, 10)}...)`)
    else { fail('CELO send failed'); process.exit(1) }
    const res = await fetch(verifyEndpoint, {
      method: 'POST', headers,
      body: JSON.stringify({ walletAddress: account.address, token: auth.token, usdtHash: txHash, payToken: 'celo', ...opts }),
    })
    const body = await res.json()
    if (res.status === 200) ok(`verify: 200 (forward ${(body.hashes?.campaignForwardHash || '').slice(0, 10)}...)`)
    else { fail(`verify: ${res.status} ${JSON.stringify(body).slice(0, 250)}`); process.exit(1) }
    return body
  }

  // Round A: 100% a la campaña
  const a = await donateRound(ROUND_A, { receiveCashback: false, pdjSharePct: 0 }, '100% campaign')
  const aCamp = Number((a.distribution || []).find((d) => d.destination === 'campaign')?.amount || 0)
  if (Math.abs(aCamp - Number(formatEther(ROUND_A))) < 0.001) ok(`distribution A: campaign = ${aCamp.toFixed(4)} CELO`)
  else fail(`distribution A inesperada: ${JSON.stringify(a.distribution)}`)
  if (a.increment === 0) ok('increment = 0 (cashback OFF)')
  else fail(`increment = ${a.increment}`)

  // Round B: 90/10
  const b = await donateRound(ROUND_B, { receiveCashback: false, pdjSharePct: 10 }, '90/10 campaign/pdJ')
  const bCamp = Number((b.distribution || []).find((d) => d.destination === 'campaign')?.amount || 0)
  const bPdj = Number((b.distribution || []).find((d) => d.destination === 'pdJ')?.amount || 0)
  if (Math.abs(bCamp - Number(formatEther((ROUND_B * 90n) / 100n))) < 0.001) ok(`distribution B: campaign = ${bCamp.toFixed(4)} (90%)`)
  else fail(`distribution B campaign = ${bCamp.toFixed(4)}`)
  if (Math.abs(bPdj - Number(formatEther((ROUND_B * 10n) / 100n))) < 0.001) ok(`distribution B: pdJ = ${bPdj.toFixed(4)} (10%)`)
  else fail(`distribution B pdJ = ${bPdj.toFixed(4)}`)
  if (a.hashes?.campaignForwardHash && b.hashes?.campaignForwardHash && b.hashes?.pdjForwardHash) {
    ok('native auto-forward hashes present (A/B campaign + B pdJ)')
  } else fail('missing native forward hashes')

  // Balance AFTER
  console.log('\n── Campaign wallet CELO balance AFTER (native auto-forward) ──')
  const expected = ROUND_A + (ROUND_B * 90n) / 100n
  const balanceAfter = await campaignCeloBalance(publicClient)
  const delta = balanceAfter - balanceBefore
  if (delta === expected) ok(`campaign wallet +${formatEther(delta)} CELO (= 100% A + 90% B)`)
  else fail(`campaign wallet +${formatEther(delta)} CELO, expected +${formatEther(expected)}`)

  // Ledger rows
  console.log('\n── /api/user-transactions ──')
  const userIdRes = await fetch(`${SITE}/api/profile?walletAddress=${encodeURIComponent(account.address)}&token=${encodeURIComponent(auth.token)}`)
  const userProfile = await userIdRes.json()
  if (!userProfile?.id) { fail('Could not get userId') }
  else {
    ok(`userId: ${userProfile.id}`)
    const txsRes = await fetch(`${SITE}/api/user-transactions/${userProfile.id}`)
    const txsData = await txsRes.json()
    const txs = txsData.transactions || []
    const celoRows = txs.filter((t) => (t.descripcion || '').includes('CELO') && (t.descripcion || '').includes('campaign:'))
    if (celoRows.length >= 2) ok(`CELO donation row(s): ${celoRows.length}`)
    else fail(`Expected ≥2 CELO campaign rows, got ${celoRows.length}`)
    const rewardRows = txs.filter((t) => t.type === 'donation_reward' &&
      ((t.subcategoria || '') === 'campaign' || (t.descripcion || '').includes('campaign')))
    if (rewardRows.length === 0) ok('no campaign donation_reward rows (cashback OFF)')
    else fail(`unexpected campaign donation_reward rows: ${rewardRows.length}`)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
