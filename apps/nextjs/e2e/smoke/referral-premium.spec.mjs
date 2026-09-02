#!/usr/bin/env node

/**
 * Smoke test E2E: Referral payout — Form 1 (10% compra premium) + Form 3
 * (1 USDT pastor bonus) cuando un REFERIDO que es PASTOR compra el curso
 * Global Disciples (REQ/163).
 *
 * Flujo (análogo a pastor-journey.spec.mjs + relación de referido):
 *   1. Referidor (wallet de apps/.env, verificador) → código de referido
 *   2. Pastor REFERIDO (billetera nueva, SIWE) → claim del código
 *   3. Pastor completa perfil Sierra Leone + verificación admin + iglesia
 *      (bonus 44 SLEARN si el fondo de iglesias tiene fondos)
 *   4. Pastor paga el curso GD (gas + transfer SLEARN + POST purchase)
 *   5. Historial del referidor (GET /api/referral/history) →
 *        - Form 1: `referral_reward` = 10% que processPayment ruteó a la
 *          billetera de referidos (igual a los items `referral` de la
 *          distribución de la respuesta de compra)
 *        - Form 3: `referral_bonus` (subcategoria pastor_bonus) = 1 USDT
 *
 * SKIP: si la billetera de referidos no tiene fondos (funding rule: sin
 * fondos la recompensa se omite).
 *
 * Ejecución:
 *   node e2e/smoke/referral-premium.spec.mjs
 *
 * Prerrequisitos (sitio dev https://learn.tg:9001):
 *   - apps/.env: PRIVATE_KEY + NEXT_PUBLIC_ADDRESS (referidor, verificador)
 *   - Billetera de referidos con fondos (PRIVATE_KEY_REFERRAL_WALLET)
 *   - Backend wallet con SLEARN para el curso (pago real testnet)
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import axios from 'axios'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, createWalletClient, http, parseUnits, parseEther } from 'viem'
import { celoSepolia } from 'viem/chains'

// ── Config ──────────────────────────────────────────────────────────

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

const GD_COURSE_ID = 10 // EN /gdcluster
const COUNTRY_SL = 694

let passed = 0
let failed = 0
let skipped = 0
function ok(msg) { passed++; console.log(`  [OK] ${msg}`) }
function fail(msg) { failed++; console.log(`  [FAIL] ${msg}`) }
function skip(msg) { skipped++; console.log(`  [SKIP] ${msg}`) }
function finish() { console.log(`\n${passed}/${passed + failed} passed · ${skipped} skipped — ${failed} failed\n`); process.exit(failed > 0 ? 1 : 0) }

const slearnTransferAbi = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
]

// ── Env helpers ─────────────────────────────────────────────────────

function loadEnvCredentials() {
  const envPaths = [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]
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
  const envPaths = [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const m = content.match(new RegExp(`${key}="([^"]+)"`)) || content.match(new RegExp(`${key}=(\\S+)`))
      if (m) return m[1]
    }
  }
  return null
}

// ── SIWE + API helpers ──────────────────────────────────────────────

function parseCookieHeader(header) { return header.split(';')[0].trim() }

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
      const c = parseCookieHeader(h)
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

async function apiGet(reqPath, params, cookies) {
  const url = new URL(reqPath, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.get(url.toString(), { httpsAgent, headers: cookies ? { Cookie: cookies } : {} })
  return res.data
}

async function apiPost(reqPath, body, params, cookies) {
  const url = new URL(reqPath, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.post(url.toString(), body, {
    httpsAgent,
    headers: { ...(cookies ? { Cookie: cookies } : {}), 'Content-Type': 'application/json' },
  })
  return res.data
}

async function apiPatch(reqPath, params, body, cookies) {
  const url = new URL(reqPath, SITE)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.patch(url.toString(), body, {
    httpsAgent,
    headers: { ...(cookies ? { Cookie: cookies } : {}), 'Content-Type': 'application/json' },
  })
  return res.data
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nReferral premium payout E2E (Form 1 + Form 3) — target: ${SITE} (chain: ${CHAIN_ID})\n`)

  const creds = loadEnvCredentials()
  if (!creds) { console.error('[ERROR] No credentials found in apps/.env'); process.exit(1) }
  const { pk: referrerPk, addr: referrerAddr } = creds

  try {
    // ════════════════════════════════════════════════════════════
    // 1. Referidor: SIWE + código
    // ════════════════════════════════════════════════════════════
    console.log('── 1. Referidor: SIWE + código ──')
    const referrer = await siweSignIn(referrerPk, referrerAddr)
    ok(`Referidor autenticado: ${referrerAddr.slice(0, 10)}...`)
    const codeData = await apiGet('/api/referral/code', { walletAddress: referrerAddr, token: referrer.token }, referrer.cookies)
    if (!codeData.code) { fail('Referidor sin código'); finish() }
    const refCode = codeData.code
    ok(`Código de referido: ${refCode}`)

    // ════════════════════════════════════════════════════════════
    // 2. Fund de referidos — sin fondos ambas recompensas se omiten
    // ════════════════════════════════════════════════════════════
    console.log('── 2. Billetera de referidos (fund) ──')
    let fund = { usdtBalance: 0, slearnBalance: 0 }
    try { fund = await apiGet('/api/referrals/fund', {}, null) } catch (e) { fail(`/api/referrals/fund falló: ${e.message}`) }
    const fundUsdt = Number(fund.usdtBalance ?? 0)
    const fundSlearn = Number(fund.slearnBalance ?? 0)
    if (fundUsdt <= 0 && fundSlearn <= 0) {
      skip('Billetera de referidos sin fondos — Form 1 y Form 3 se omitirían (funding rule)')
      finish()
    }
    ok(`Fund con fondos: ${fundSlearn} SLEARN · ${fundUsdt} USDT`)

    // ════════════════════════════════════════════════════════════
    // 3. Pastor referido: billetera nueva → SIWE → claim
    // ════════════════════════════════════════════════════════════
    console.log('── 3. Pastor referido: SIWE + claim ──')
    const pastorPk = generatePrivateKey()
    const pastorAddr = privateKeyToAccount(pastorPk).address
    const testEmail = `refpastor-${pastorAddr.slice(2, 10).toLowerCase()}@learn.tg`
    const pastor = await siweSignIn(pastorPk, pastorAddr)
    ok(`Pastor registrado (SIWE): ${pastorAddr.slice(0, 10)}...`)

    const claimRes = await axios.post(`${SITE}/api/referral/claim`, {
      walletAddress: pastorAddr, token: pastor.token, code: refCode,
    }, { httpsAgent, validateStatus: s => s < 500 }).catch(e => ({ status: e?.response?.status, data: e?.response?.data }))
    if (claimRes.status === 200 && claimRes.data?.ok) ok(`Claim 200 — relación creada (referrer_id=${claimRes.data.referrer_id})`)
    else if (claimRes.status === 429) { skip('Rate-limit del claim (REQ/163: 10/día por IP) — reintenta en 24h'); finish() }
    else { fail(`Claim falló: ${claimRes.status} ${JSON.stringify(claimRes.data)}`); finish() }

    // ════════════════════════════════════════════════════════════
    // 4. Perfil Sierra Leone del pastor + verificación admin + iglesia
    // ════════════════════════════════════════════════════════════
    console.log('── 4. Perfil SL + verificación + iglesia (44 SLEARN) ──')
    await apiPatch('/api/profile',
      { walletAddress: pastorAddr, token: pastor.token },
      {
        nombre: 'Pastor Referido E2E',
        email: testEmail,
        whatsapp: '+23276123456',
        pais_id: COUNTRY_SL,
        religion_id: 2,
        church_relationship: 'pastor',
        position_israel_gaza: 'no',
        place_of_worship: 'E2E Referral Church',
        place_of_worship_location: 'Freetown',
        registration: `E2E-REF-${pastorAddr.slice(2, 8).toUpperCase()}`,
        denomination: 'E2E Denomination',
      }, pastor.cookies).catch((e) => { fail(`Profile PATCH: ${e?.message}`); finish() })
    ok('Perfil del pastor guardado (SL, cristiano, pastor, no-sionista)')

    const pastorProfile = await apiGet('/api/profile', { walletAddress: pastorAddr, token: pastor.token }, pastor.cookies)
    const pastorUserId = pastorProfile.id
    ok(`Pastor userId: ${pastorUserId}`)

    const verifyRes = await apiPatch(`/api/admin/user/${pastorUserId}`,
      { wallet: referrerAddr, token: referrer.token },
      {
        passport_name: 'Pastor Referido E2E',
        passport_nationality: COUNTRY_SL,
        verified_email: testEmail,
        verified_whatsapp: '+23276123456',
        verified_place_of_worship: 'E2E Referral Church',
        verified_place_of_worship_location: 'Freetown',
        verified_church_relationship: 'pastor',
        proposed_date_of_interview: '2026-09-01',
      }, referrer.cookies).catch((e) => ({ error: e?.message }))
    const vScore = Number(verifyRes?.user?.profilescore ?? 0)
    if (verifyRes?.success || verifyRes?.user) ok(`Verificado por admin (score ${vScore})`)
    else { fail(`Verificación admin falló: ${JSON.stringify(verifyRes).slice(0, 140)}`); finish() }

    let churchId = null
    try {
      const churchRes = await apiPost('/api/admin/churches',
        { name: 'E2E Referral Church', country_id: COUNTRY_SL, denomination: 'E2E Denomination' },
        { wallet: referrerAddr, token: referrer.token }, referrer.cookies)
      churchId = churchRes?.church?.id
      if (churchId) ok(`Iglesia creada (#${churchId})`)
      else fail(`Creación de iglesia falló: ${JSON.stringify(churchRes).slice(0, 120)}`)
    } catch (e) { fail(`Creación de iglesia: ${e.message}`) }

    if (churchId) {
      await apiPatch(`/api/admin/user/${pastorUserId}`, { wallet: referrerAddr, token: referrer.token }, { church_id: churchId }, referrer.cookies).catch(() => {})
      const chVerify = await apiPatch(`/api/admin/church/${churchId}`, { wallet: referrerAddr, token: referrer.token }, { registration_verified: true }, referrer.cookies).catch(() => ({}))
      if (chVerify?.bonus?.awarded) ok(`44 SLEARN bonus (tx ${String(chVerify.bonus.hash).slice(0, 10)}...)`)
      else console.log(`  [!] Bonus 44 SLEARN no otorgado: ${chVerify?.bonus?.reason || '(sin fondos del fondo de iglesias?)'}`)
    }

    const scoreCheck = await apiGet('/api/profile', { walletAddress: pastorAddr, token: pastor.token }, pastor.cookies)
    if (Number(scoreCheck.profilescore) > 90) ok(`Score del pastor: ${scoreCheck.profilescore} (> 90)`)
    else console.log(`  [!] Score del pastor: ${scoreCheck.profilescore} (esperado > 90)`)

    // ════════════════════════════════════════════════════════════
    // 5. Compra del curso GD (on-chain): gas + SLEARN + purchase
    // ════════════════════════════════════════════════════════════
    console.log('── 5. Compra del curso GD ──')
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || loadEnvValue('NEXT_PUBLIC_RPC_URL') || 'https://forno.celo-sepolia.celo-testnet.org'
    let slearnAddress = process.env.NEXT_PUBLIC_SLEARN_ADDRESS || loadEnvValue('NEXT_PUBLIC_SLEARN_ADDRESS')
    let backendWallet = referrerAddr
    try {
      const fundRes = await axios.get(`${SITE}/api/churches/fund`, { httpsAgent })
      if (fundRes.data?.slearnAddress) slearnAddress = fundRes.data.slearnAddress
      if (fundRes.data?.address) backendWallet = fundRes.data.address
    } catch { /* env fallback */ }

    const publicClient = createPublicClient({ chain: celoSepolia, transport: http(rpcUrl) })
    const funder = privateKeyToAccount(referrerPk)
    const funderClient = createWalletClient({ account: funder, chain: celoSepolia, transport: http(rpcUrl) })
    const gasHash = await funderClient.sendTransaction({ to: pastorAddr, value: parseEther('0.1') })
    await publicClient.waitForTransactionReceipt({ hash: gasHash })
    ok('Pastor financiado con CELO para gas')

    const price = await apiGet('/api/courses/premium/price', { courseId: GD_COURSE_ID, walletAddress: pastorAddr, token: pastor.token }, pastor.cookies)
    const priceSlearn = Number(price?.priceSLEARN ?? 39.6)
    const paymentSlearn = parseUnits(String(priceSlearn), 2)
    console.log(`  Precio del curso (SLEARN): ${priceSlearn.toFixed(2)}`)

    const pastorAccount = privateKeyToAccount(pastorPk)
    const pastorClient = createWalletClient({ account: pastorAccount, chain: celoSepolia, transport: http(rpcUrl) })
    const slearnHash = await pastorClient.writeContract({
      address: slearnAddress,
      abi: slearnTransferAbi,
      functionName: 'transfer',
      args: [backendWallet, paymentSlearn],
    })
    await publicClient.waitForTransactionReceipt({ hash: slearnHash })
    ok(`SLEARN transferido al backend (tx ${slearnHash.slice(0, 10)}...)`)

    const purchaseRes = await axios.post(`${SITE}/api/courses/premium/purchase`, {
      walletAddress: pastorAddr, token: pastor.token, courseId: GD_COURSE_ID, slearnHash,
    }, { httpsAgent, validateStatus: s => s < 500 }).catch(e => ({ status: e?.response?.status, data: e?.response?.data }))
    if (purchaseRes.status !== 200 && purchaseRes.status !== 201) {
      fail(`Compra falló: ${purchaseRes.status} ${JSON.stringify(purchaseRes.data).slice(0, 160)}`)
      finish()
    }
    ok('Curso GD comprado')

    const purchaseBody = purchaseRes.data
    const refDist = (purchaseBody.distribution || []).filter(d => d.destination === 'referral')
    const expectedForm1 = {
      usdt: refDist.filter(d => d.crypto === 'usdt').reduce((s, d) => s + Number(d.amount), 0),
      slearn: refDist.filter(d => d.crypto === 'slearn').reduce((s, d) => s + Number(d.amount), 0),
    }
    if (refDist.length > 0) ok(`Distribución referral: ${expectedForm1.slearn.toFixed(2)} SLEARN · ${expectedForm1.usdt.toFixed(2)} USDT`)
    else console.log('  [!] Sin items "referral" en la distribución de la compra')

    // ════════════════════════════════════════════════════════════
    // 6. Historial del referidor: Form 1 (10%) + Form 3 (1 USDT)
    // ════════════════════════════════════════════════════════════
    console.log('── 6. Historial del referidor: Form 1 + Form 3 ──')
    const hist = await apiGet('/api/referral/history', { walletAddress: referrerAddr, token: referrer.token }, referrer.cookies)
    const rewards = (hist.rewards || []).filter(r => Number(r.metadata?.referred_id) === pastorUserId && Number(r.metadata?.course_id) === GD_COURSE_ID)

    // Form 1: referral_reward = 10% (lo que processPayment ruteó a la referral wallet)
    const f1Usdt = rewards.filter(r => r.type === 'referral_reward' && r.crypto === 'usdt').reduce((s, r) => s + Number(r.amount), 0)
    const f1Slearn = rewards.filter(r => r.type === 'referral_reward' && r.crypto === 'slearn').reduce((s, r) => s + Number(r.amount), 0)
    if (f1Usdt > 0 || f1Slearn > 0) {
      ok(`Form 1 pagado: ${f1Slearn.toFixed(2)} SLEARN · ${f1Usdt.toFixed(2)} USDT`)
      if (Math.abs(f1Slearn - expectedForm1.slearn) < 0.01 && Math.abs(f1Usdt - expectedForm1.usdt) < 0.01) {
        ok('Cuantía Form 1 = distribución referral (10%)')
      } else {
        fail(`Cuantía Form 1 inesperada: ${f1Slearn}/${f1Usdt} vs esperado ${expectedForm1.slearn}/${expectedForm1.usdt}`)
      }
    } else {
      fail(`Form 1 NO pagado — rewards del referido: ${JSON.stringify(rewards).slice(0, 200) || '(ninguna)'} (¿redeploy pendiente del wrapper premium/purchase?)`)
    }

    // Form 3: referral_bonus (pastor_bonus) = 1 USDT
    const f3 = rewards.filter(r => r.type === 'referral_bonus' && r.subcategoria === 'pastor_bonus' && r.crypto === 'usdt')
    const f3Amount = f3.reduce((s, r) => s + Number(r.amount), 0)
    if (f3Amount >= 1) ok(`Form 3 pagado: ${f3Amount.toFixed(2)} USDT (pastor bonus)`)
    else fail(`Form 3 NO pagado (1 USDT pastor bonus) — rewards: ${JSON.stringify(rewards).slice(0, 200) || '(ninguna)'}`)

    // Idempotencia: 1 reward + 1 bonus
    const dupes = rewards.filter(r => r.type === 'referral_reward')
    if (dupes.length <= 2) ok(`Idempotente: ${dupes.length} reward(s) para esta relación/curso`)
    else fail(`Idempotencia rota: ${dupes.length} rewards`)

    // ════════════════════════════════════════════════════════════
    // 7. Notificaciones al referidor (Form 1 reward + Form 3 bonus)
    // ════════════════════════════════════════════════════════════
    console.log('── 7. Notificaciones al referidor ──')
    const notif = await apiGet('/api/notifications',
      { walletAddress: referrerAddr, token: referrer.token }, referrer.cookies)
    const types = (notif.notifications || []).map(n => n.type)
    const rewardNotif = (notif.notifications || []).find(n => n.type === 'referral_reward' && /USDT/.test(String(n.content || '')))
    const bonusNotif = (notif.notifications || []).find(n => n.type === 'referral_bonus' && n.subcategoria === undefined && /USDT/.test(String(n.content || '')))
    if (rewardNotif) ok(`Notificación Form 1: "${rewardNotif.title}" (${String(rewardNotif.content).slice(0, 120)})`)
    else fail(`Sin notificación referral_reward. Types: ${JSON.stringify(types)}`)
    if (bonusNotif) ok(`Notificación Form 3 (pastor bonus): "${bonusNotif.title}"`)
    else fail(`Sin notificación referral_bonus. Types: ${JSON.stringify(types)}`)
  } catch (e) {
    fail(`Error inesperado: ${e.message}`)
    if (e.response) console.log(`   Response: ${JSON.stringify(e.response.data)?.slice(0, 300)}`)
  }

  finish()
}

main().catch(err => { console.error('[ERROR]', err.message); process.exit(1) })
