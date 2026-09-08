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
 *      Round C (cashback ON, ROUND_C_USDT, por defecto 10 USDT @ pdJ 5%):
 *               el 10% sale de la misma donación → campaña 85%, pdJ 5% y
 *               cashback 22.00 SLEARN vía mintAndReserve (reserva en USDT)
 *   5. Response: distribution (campaign / pdJ / cashback) + forward hashes
 *   6. Campaign wallet balance AFTER: increased by exactly the campaign share
 *      (100% A + 90% B + 85% C — nunca el 100% con cashback ON)
 *   7. /api/user-transactions: donation rows with campaign breakdown and
 *      donation_reward row only for the cashback round (22 SLEARN)
 *
 * Prerequisites on the dev server (see doc/e2e-testing.md):
 *   - Campaign engine deployed (donations/[slug]/verify, network-aware)
 *   - NEXT_PUBLIC_USDT_ADDRESS = dev MockUSDT (apps/.env)
 *   - NEXT_PUBLIC_PDJ_TREASURY_ADDRESS set (dev: single wallet)
 *   - Round C requires MINTER_ROLE on SLEARN + learnTgReserve (dev Sepolia)
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
import { dedicatedApiTokenFetch } from '../helpers/siwe-auth.mjs'

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
// Ronda C: cashback ON (10 USDT @ pdj 5% por defecto). ROUND_C_USDT=0 la omite.
const ROUND_C_USDT = Number(process.env.ROUND_C_USDT || '10')
const ROUND_C_PDJ = Number(process.env.ROUND_C_PDJ || '5')

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

  const apiToken = await dedicatedApiTokenFetch(base, cookies, csrfToken)

  return { token: apiToken, cookies }
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
let slearnAddr = ''

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
  slearnAddr = process.env.NEXT_PUBLIC_SLEARN_ADDRESS
  console.log(`  USDT (dev Mock): ${usdtAddr}`)
  if (!slearnAddr) console.log('  (NEXT_PUBLIC_SLEARN_ADDRESS no configurado — ronda C sin chequeo de saldo SLEARN)')
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
  const totalNeed = ROUND_A_USDT + ROUND_B_USDT + (ROUND_C_USDT > 0 ? ROUND_C_USDT : 0)
  if (Number(formatUnits(donorBal, 6)) < totalNeed) {
    fail(`Not enough USDT in the test wallet (need ${totalNeed})`)
    process.exit(1)
  }

  const auth = await siweSignIn(SITE, account)
  if (!auth) { console.log(`\n${passed} passed, ${failed} failed`); process.exit(1) }
  ok('SIWE sign-in OK')
  const headers = { 'Content-Type': 'application/json', ...(auth.cookies ? { Cookie: auth.cookies } : {}) }

  // ── Baseline del ledger (el dev ledger es acumulativo entre corridas) ──
  const ledgerBaseline = { campaign: [], reward: [] }
  try {
    const prof = await (await fetch(`${SITE}/api/profile?walletAddress=${encodeURIComponent(account.address)}&token=${encodeURIComponent(auth.token)}`, { headers })).json()
    if (prof?.id) {
      const txs = (await (await fetch(`${SITE}/api/user-transactions/${prof.id}`, { headers })).json()).transactions || []
      ledgerBaseline.campaign = txs.filter(t => t.type === 'donation' && (t.descripcion || '').includes('campaign:'))
      ledgerBaseline.reward = txs.filter(t => t.type === 'donation_reward' && (t.subcategoria === 'campaign' || (t.descripcion || '').includes('campaign')))
    }
  } catch { /* sin baseline: los chequeos finales usan mínimo absoluto */ }

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

  // ── Round C: cashback ON — el 10% sale de la misma donación (campaña neta) ──
  let expected = ROUND_A_USDT + ROUND_B_USDT * 0.9
  if (ROUND_C_USDT > 0) {
    const cbIncrement = Math.round(ROUND_C_USDT * 0.1 * 22 * 100) / 100 // 22 SLEARN con 10 USDT
    const campShare = (100 - ROUND_C_PDJ - 10) / 100
    const slearnDecimals = 2
    // Saldo SLEARN del donante y USDT en la reserva caliente del contrato
    // SLEARN (learnTgReserve) ANTES de la ronda, para comprobar después el
    // mint + el 10% retenido (mintAndReserve envía el USDT a learnTgReserve).
    const slearnBefore = slearnAddr
      ? await rpcRetry(() => publicClient.readContract({ address: slearnAddr, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }))
      : null
    const reserveAbi = [{ name: 'learnTgReserve', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }]
    const reserveAddr = slearnAddr
      ? await rpcRetry(() => publicClient.readContract({ address: slearnAddr, abi: reserveAbi, functionName: 'learnTgReserve' })).catch(() => null)
      : null
    const poolBefore = (slearnAddr && reserveAddr)
      ? await rpcRetry(() => publicClient.readContract({ address: usdtAddr, abi: erc20Abi, functionName: 'balanceOf', args: [reserveAddr] }))
      : null

    const c = await donateRound(ROUND_C_USDT, { receiveCashback: true, pdjSharePct: ROUND_C_PDJ }, 'cashback ON (85/5/10)')
    const distC = c.body.distribution || []
    const campaignC = Number((distC.find(d => d.destination === 'campaign') || {}).amount || 0)
    const pdjC = Number((distC.find(d => d.destination === 'pdJ') || {}).amount || 0)
    const cbC = Number((distC.find(d => d.destination === 'cashback') || {}).amount || 0)
    if (Math.abs(campaignC - ROUND_C_USDT * campShare) < 0.001) {
      ok(`distribution C: campaign = ${campaignC.toFixed(2)} USDT (${(campShare * 100).toFixed(0)}% neto de ${ROUND_C_USDT})`)
    } else fail(`distribution C campaign = ${campaignC.toFixed(2)} (se esperaba ${ROUND_C_USDT * campShare})`)
    if (Math.abs(pdjC - ROUND_C_USDT * (ROUND_C_PDJ / 100)) < 0.001) ok(`distribution C: pdJ = ${pdjC.toFixed(2)} USDT (${ROUND_C_PDJ}%)`)
    else fail(`distribution C pdJ = ${pdjC.toFixed(2)}`)
    if (Math.abs(cbC - cbIncrement) < 0.001 && c.body.increment === cbIncrement) {
      ok(`distribution C: cashback = ${cbC.toFixed(2)} SLEARN (increment ${c.body.increment})`)
    } else fail(`distribution C cashback = ${cbC.toFixed(2)} (increment ${c.body.increment}, se esperaba ${cbIncrement})`)
    if (c.body.hashes?.mintHash) ok(`mintAndReserve hash present (${c.body.hashes.mintHash.slice(0, 10)}...)`)
    else fail('missing mintHash in the response (mintAndReserve no se ejecutó)')

    // El donante recibió el SLEARN minteado por mintAndReserve
    if (slearnAddr && slearnBefore != null) {
      const slearnAfter = await rpcRetry(() => publicClient.readContract({ address: slearnAddr, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }))
      const slearnDelta = Number(formatUnits(slearnAfter - slearnBefore, slearnDecimals))
      if (Math.abs(slearnDelta - cbIncrement) < 0.02) ok(`donor SLEARN +${slearnDelta.toFixed(2)} (= cashback ${cbIncrement.toFixed(2)})`)
      else fail(`donor SLEARN delta +${slearnDelta.toFixed(2)}, se esperaba +${cbIncrement.toFixed(2)}`)
    }
    // El 10% retenido fue a la reserva caliente del contrato SLEARN
    // (learnTgReserve), respaldando el SLEARN. El pozo es COMPARTIDO entre
    // minters: otros mintAndReserve (p. ej. donaciones a cursos) pueden
    // engrosarlo durante la ventana, por eso se valida un mínimo de +10% y
    // mintAndReserve solo tiene éxito si el USDT se transfirió antes (revierte
    // con "insufficient USDT balance" si no — el +22 SLEARN del donante ya lo
    // prueba).
    if (slearnAddr && poolBefore != null && reserveAddr) {
      const poolAfter = await rpcRetry(() => publicClient.readContract({ address: usdtAddr, abi: erc20Abi, functionName: 'balanceOf', args: [reserveAddr] }))
      const poolDelta = Number(formatUnits(poolAfter - poolBefore, 6))
      const expectedReserve = ROUND_C_USDT * 0.1
      if (poolDelta >= expectedReserve - 0.02) {
        ok(`learnTgReserve USDT +${poolDelta.toFixed(2)} (≥ +${expectedReserve.toFixed(2)} de esta donación${poolDelta > expectedReserve + 0.02 ? '; el excedente es de otros minters del pozo compartido' : ''})`)
      } else fail(`learnTgReserve USDT delta +${poolDelta.toFixed(2)}, se esperaba ≥ +${expectedReserve.toFixed(2)}`)
    }
    expected = ROUND_A_USDT + ROUND_B_USDT * 0.9 + ROUND_C_USDT * campShare
  }

  // ── Campaign wallet AFTER: campaña nunca recibe el 100% con cashback ON ──
  console.log('\n── Campaign wallet balance AFTER (auto-forward) ──')
  const balanceAfter = await campaignUsdtBalance(publicClient)
  const delta = balanceAfter - balanceBefore
  if (Math.abs(delta - expected) < 0.01) {
    ok(`campaign wallet +${delta.toFixed(2)} USDT (100% de ${ROUND_A_USDT} + 90% de ${ROUND_B_USDT}${ROUND_C_USDT > 0 ? ` + ${((100 - ROUND_C_PDJ - 10) / 100 * ROUND_C_USDT).toFixed(2)} (85% de ${ROUND_C_USDT})` : ''})`)
  } else {
    fail(`campaign wallet +${delta.toFixed(2)} USDT, se esperaba +${expected.toFixed(2)}`)
  }

  // ── Ledger rows (user transactions): deltas contra el baseline ──
  console.log('\n── /api/user-transactions (deltas vs baseline) ──')
  const activeRounds = (ROUND_A_USDT > 0 ? 1 : 0) + (ROUND_B_USDT > 0 ? 1 : 0) + (ROUND_C_USDT > 0 ? 1 : 0)
  const userIdRes = await fetch(`${SITE}/api/profile?walletAddress=${encodeURIComponent(account.address)}&token=${encodeURIComponent(auth.token)}`, { headers })
  const userProfile = await userIdRes.json()
  if (!userProfile?.id) { fail('Could not get userId') }
  else {
    ok(`userId: ${userProfile.id}`)
    const txs = (await (await fetch(`${SITE}/api/user-transactions/${userProfile.id}`, { headers })).json()).transactions || []
    const campaignRows = txs.filter(t => t.type === 'donation' && (t.descripcion || '').includes('campaign:'))
    const rewardRows = txs.filter(t => t.type === 'donation_reward' && (t.subcategoria === 'campaign' || (t.descripcion || '').includes('campaign')))
    const baseCampaignIds = new Set(ledgerBaseline.campaign.map(t => t.id).filter(Boolean))
    const baseRewardIds = new Set(ledgerBaseline.reward.map(t => t.id).filter(Boolean))
    const newCampaign = campaignRows.filter(t => !baseCampaignIds.has(t.id))
    const newReward = rewardRows.filter(t => !baseRewardIds.has(t.id))
    if (newCampaign.length >= activeRounds) ok(`new campaign donation rows: ${newCampaign.length} (≥${activeRounds} rondas)`)
    else fail(`new campaign donation rows: ${newCampaign.length}, se esperaban ≥${activeRounds}`)
    if (ROUND_C_USDT > 0) {
      // La fila nueva de la ronda C debe mostrar el desglose NETO (cashback
      // dentro de la misma donación: campaign 8.50 de 10 USDT, no 10.00)
      const cbRow = newCampaign.find(d => d.descripcion.includes(`donated: ${ROUND_C_USDT}.00 USDT`))
      if (cbRow && cbRow.descripcion.includes(`campaign: ${(ROUND_C_USDT * (100 - ROUND_C_PDJ - 10) / 100).toFixed(2)} USDT`)) {
        ok(`round C row shows net breakdown: ${cbRow.descripcion.split('\n').slice(1, 3).join(' · ')}`)
      } else if (cbRow) fail(`round C descripcion inesperada: ${cbRow.descripcion}`)
      else fail('round C donation row not found among the new rows')
    }
    if (ROUND_C_USDT > 0) {
      const want = Math.round(ROUND_C_USDT * 0.1 * 22 * 100) / 100
      if (newReward.length === 1) {
        const amount = Number(newReward[0].amount || 0)
        if (Math.abs(amount - want) < 0.01) ok(`exactly one new donation_reward row: ${amount.toFixed(2)} SLEARN (ronda C)`)
        else fail(`donation_reward amount ${amount}, se esperaba ${want}`)
      } else fail(`expected 1 new donation_reward row (ronda C), got ${newReward.length}`)
    } else {
      if (newReward.length === 0) ok('no new donation_reward rows (cashback OFF)')
      else fail(`unexpected new donation_reward rows: ${newReward.length}`)
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
