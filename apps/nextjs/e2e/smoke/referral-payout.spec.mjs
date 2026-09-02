#!/usr/bin/env node

/**
 * Smoke test E2E: Referral payout (REQ/163, Form 2 — desembolso real)
 *
 * Verifica el desembolso de la recompensa de referidos cuando un usuario
 * REFERIDO completa un crucigrama de un curso MISIONAL ("A relationship
 * with Jesus", id 2): el referidor debe recibir el 10% del scholarship
 * (USDT + SLEARN), pagado DESDE la billetera de referidos, y la recompensa
 * debe quedar registrada en /api/referral/history como `referral_reward`.
 *
 * Flujo:
 *   1. Referidor (wallet de apps/.env, verificador) → código de referido
 *   2. Referido (billetera NUEVA, SIWE auto-registra) → claim del código
 *   3. Perfil del referido → score ≥ 50 (requisito del contrato de becas)
 *   4. Referido resuelve el crucigrama de la guía 1 (curso 2, perfecto)
 *   5. POST /api/check-crossword → scholarshipUsdt/scholarshipSlearn > 0
 *   6. GET /api/referral/history (referidor) → reward 10% registrada
 *
 * SKIP: si la billetera de referidos no tiene fondos (funding rule: si no
 * hay fondos la recompensa se omite), o si el vault del curso no paga.
 *
 * Ejecución:
 *   bin/m test:e2e referral-payout --smoke
 *   o: node e2e/smoke/referral-payout.spec.mjs
 *
 * Prerrequisitos (sitio dev https://learn.tg:9001):
 *   - apps/.env: PRIVATE_KEY + NEXT_PUBLIC_ADDRESS (referidor, verificador)
 *   - Billetera de referidos con fondos (PRIVATE_KEY_REFERRAL_WALLET)
 *   - Vault del curso 2 con fondos en el contrato LearnTGVaultsV5 (Sepolia)
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import axios from 'axios'
import https from 'https'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

// ── Config ──────────────────────────────────────────────────────────

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

// Curso misional EN: "A relationship with Jesus" (id 2), guía 1
const COURSE_ID = 2
const COURSE_PREFIX = 'a-relationship-with-Jesus'
const GUIDE_SUFFIX = 'guide1'
const LANG = 'en'
const GUIDE_NUMBER = 1 // posición 1-indexada de la guía en el curso

let passed = 0
let failed = 0
let skipped = 0
function ok(msg) { passed++; console.log(`  [OK] ${msg}`) }
function fail(msg) { failed++; console.log(`  [FAIL] ${msg}`) }
function skip(msg) { skipped++; console.log(`  [SKIP] ${msg}`) }

// ── Preguntas/respuestas de la guía 1 (mismas que celo-claim.spec.mjs) ──

const QUESTION_ANSWER_PAIRS = [
  { clueSubstrings: ['A landscape mentioned', 'landscape mentioned'], answer: 'mountain' },
  { clueSubstrings: ['Jesus had sent His disciples', 'sent His disciples to'], answer: 'Bethsaida' },
  { clueSubstrings: ['After sending away the people', 'Jesus went to'], answer: 'pray' },
  { clueSubstrings: ['Seeing His disciples distress', 'came close to the boat', 'walking on the sea'], answer: 'walking' },
  { clueSubstrings: ['The disciples cried', 'thought that the one walking', 'was a ghost'], answer: 'ghost' },
  { clueSubstrings: ['As soon as the disciples got scared', 'Cheer up! Its i I! Don\'t be', 'Don\'t be'], answer: 'afraid' },
  { clueSubstrings: ['Then Jesus went into the boat', 'the wind ceased', 'wind'], answer: 'ceased' },
  { clueSubstrings: ['If you read the passage before', 'miraculous sharing of bread', 'their hearts were'], answer: 'hardened' },
]

function normalizeClue(text) {
  return text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/[_\-\—]/g, ' ')
    .trim()
    .toLowerCase()
}

function solveCrossword(grid, placements) {
  const solved = grid.map(row => row.map(cell => ({ ...cell, userInput: '' })))
  placements.forEach((placement) => {
    const normalized = normalizeClue(placement.clue)
    let pair = null
    for (const p of QUESTION_ANSWER_PAIRS) {
      for (const sub of p.clueSubstrings) {
        if (normalized.includes(normalizeClue(sub))) { pair = p; break }
      }
      if (pair) break
    }
    if (!pair) throw new Error(`No answer found for clue: ${placement.clue.slice(0, 80)}`)
    const { row, col, direction } = placement
    for (let i = 0; i < pair.answer.length; i++) {
      const r = direction === 'down' ? row + i : row
      const c = direction === 'across' ? col + i : col
      if (solved[r] && solved[r][c]) solved[r][c].userInput = pair.answer[i].toUpperCase()
    }
  })
  return solved
}

// ── Env credentials (referidor = wallet de apps/.env, verificador) ──

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] ||
                 content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] ||
                   content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

// ── SIWE sign-in (registra la billetera si es nueva) ──

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

// ── API helpers ──

async function apiGet(reqPath, params, cookies) {
  const url = new URL(reqPath, SITE)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.get(url.toString(), { httpsAgent, headers: cookies ? { Cookie: cookies } : {} })
  return res.data
}

async function apiPost(reqPath, body, params, cookies) {
  const url = new URL(reqPath, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.post(url.toString(), body, {
    httpsAgent,
    headers: {
      ...(cookies ? { Cookie: cookies } : {}),
      'Content-Type': 'application/json',
    },
  })
  return res.data
}

async function apiPatch(reqPath, params, body, cookies) {
  const url = new URL(reqPath, SITE)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.patch(url.toString(), body, {
    httpsAgent,
    headers: {
      ...(cookies ? { Cookie: cookies } : {}),
      'Content-Type': 'application/json',
    },
  })
  return res.data
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nReferral payout E2E — target: ${SITE} (chain: ${CHAIN_ID})\n`)

  const creds = loadEnvCredentials()
  if (!creds) { console.error('[ERROR] No credentials found in apps/.env'); process.exit(1) }
  const { pk: referrerPk, addr: referrerAddr } = creds

  try {
    // ════════════════════════════════════════════════════════════
    // 1. Referidor: SIWE + código de referido
    // ════════════════════════════════════════════════════════════
    console.log('── 1. Referidor: SIWE + código ──')
    const referrer = await siweSignIn(referrerPk, referrerAddr)
    ok(`Referidor autenticado: ${referrerAddr.slice(0, 10)}...`)

    const codeData = await apiGet('/api/referral/code',
      { walletAddress: referrerAddr, token: referrer.token }, referrer.cookies)
    if (!codeData.code) { fail('Referidor sin código de referido'); finish() }
    const refCode = codeData.code
    ok(`Código de referido: ${refCode}`)

    // ════════════════════════════════════════════════════════════
    // 2. Referido: billetera nueva → SIWE → claim del código
    // ════════════════════════════════════════════════════════════
    console.log('── 2. Referido: billetera nueva + claim ──')
    const refPk = generatePrivateKey()
    const refAccount = privateKeyToAccount(refPk)
    const refAddr = refAccount.address
    const referred = await siweSignIn(refPk, refAddr)
    ok(`Referido registrado (SIWE auto-registro): ${refAddr.slice(0, 10)}...`)

    const claimRes = await axios.post(`${SITE}/api/referral/claim`, {
      walletAddress: refAddr,
      token: referred.token,
      code: refCode,
    }, { httpsAgent, validateStatus: s => s < 500 }).catch(e => ({ status: e?.response?.status, data: e?.response?.data }))
    if (claimRes.status === 200 && claimRes.data?.ok) {
      ok(`Claim 200 — relación creada (referrer_id=${claimRes.data.referrer_id})`)
    } else if (claimRes.status === 429) {
      skip('Rate-limit del claim (REQ/163: 5/día por IP) — reintenta en 24h')
      finish()
    } else {
      // El referido pudo haberse reclamado en una corrida anterior (idempotencia)
      if (claimRes.status === 400 && String(claimRes.data?.error || '').includes('already')) {
        skip('El referido ya tenía referidor (corrida previa) — continúa con la recompensa igual')
      } else {
        fail(`Claim falló: ${claimRes.status} ${JSON.stringify(claimRes.data)}`)
        finish()
      }
    }

    // ════════════════════════════════════════════════════════════
    // 3. Fund de referidos — sin fondos la recompensa se omite (funding rule)
    // ════════════════════════════════════════════════════════════
    console.log('── 3. Billetera de referidos (fund) ──')
    let fund = { usdtBalance: 0, slearnBalance: 0 }
    try { fund = await apiGet('/api/referrals/fund', {}, null) } catch (e) { fail(`/api/referrals/fund falló: ${e.message}`) }
    const fundUsdt = Number(fund.usdtBalance ?? 0)
    const fundSlearn = Number(fund.slearnBalance ?? 0)
    if (fundUsdt <= 0 && fundSlearn <= 0) {
      skip('Billetera de referidos sin fondos — la recompensa se omitiría (funding rule REQ/163)')
      finish()
    }
    ok(`Fund con fondos: ${fundSlearn} SLEARN · ${fundUsdt} USDT`)

    // ════════════════════════════════════════════════════════════
    // 4. Perfil del referido → score ≥ 50 (PATCH perfil + auto-verificación admin)
    // ════════════════════════════════════════════════════════════
    console.log('── 4. Perfil del referido → score ≥ 50 ──')
    let referredProfile = await apiGet('/api/profile',
      { walletAddress: refAddr, token: referred.token }, referred.cookies)
    const referredUserId = referredProfile.id
    if (!referredUserId) { fail('Referido sin usuario_id'); finish() }

    await apiPatch('/api/profile',
      { walletAddress: refAddr, token: referred.token },
      {
        nombre: referredProfile.nombre || 'Referido E2E',
        email: `ref-e2e-${refAddr.slice(2, 7)}@learn.tg`,
        whatsapp: '+1234567890',
        place_of_worship: 'E2E Test Church',
      }, referred.cookies).catch(() => {})

    // Re-fetch para leer los valores verificados por el verificador (referidor)
    referredProfile = await apiGet('/api/profile',
      { walletAddress: refAddr, token: referred.token }, referred.cookies)
    await apiPatch(`/api/admin/user/${referredUserId}`,
      { wallet: referrerAddr, token: referrer.token },
      {
        passport_name: referredProfile.nombre,
        passport_nationality: referredProfile.pais_id,
        verified_email: referredProfile.email,
        verified_whatsapp: referredProfile.whatsapp,
        verified_place_of_worship: referredProfile.place_of_worship,
      }, referrer.cookies).catch((e) => {
        console.log(`   [warn] admin verify: ${e?.response?.data ? JSON.stringify(e.response.data) : e.message}`)
      })

    const finalProfile = await apiGet('/api/profile',
      { walletAddress: refAddr, token: referred.token }, referred.cookies)
    const score = Number(finalProfile.profilescore ?? 0)
    if (score >= 50) {
      ok(`Referido con profile score ${score} (≥ 50 ✓)`)
    } else {
      fail(`Referido con profile score ${score} (< 50 — el contrato no pagaría beca)`)
      finish()
    }

    // ════════════════════════════════════════════════════════════
    // 5. Referido resuelve el crucigrama (guía 1, curso 2) — perfecto
    // ════════════════════════════════════════════════════════════
    console.log('── 5. Crucigrama perfecto (curso misional) ──')
    // Vista de la guía (Rails guarda answer_fib) + datos del crucigrama
    await apiGet('/api/guide',
      { lang: LANG, prefix: COURSE_PREFIX, guide: GUIDE_SUFFIX, walletAddress: refAddr }, null)
      .catch(() => {})
    const cw = await apiGet('/api/crossword', {
      lang: LANG,
      prefix: COURSE_PREFIX,
      guide: GUIDE_SUFFIX,
      walletAddress: refAddr,
      token: referred.token,
      test: 'true',
    }, referred.cookies)
    const { grid, placements } = cw
    if (!grid || !placements || placements.length === 0) { fail('Sin datos de crucigrama'); finish() }
    const solvedGrid = solveCrossword(grid, placements)

    const checkRes = await axios.post(`${SITE}/api/check-crossword`, {
      courseId: COURSE_ID,
      guideId: GUIDE_NUMBER,
      lang: LANG,
      grid: solvedGrid,
      placements,
      walletAddress: refAddr,
      token: referred.token,
    }, { httpsAgent, validateStatus: s => s < 500 }).catch(e => ({ status: e?.response?.status, data: e?.response?.data }))

    const checkData = checkRes.data || {}
    const msg = String(checkData.message || '')
    const usdtPaid = Number(checkData.scholarshipUsdt ?? 0)
    const slearnPaid = Number(checkData.scholarshipSlearn ?? 0)
    const hasTx = !!checkData.scholarshipResult
    const fieldsPresent = 'scholarshipUsdt' in checkData || 'scholarshipSlearn' in checkData

    if (usdtPaid > 0 || slearnPaid > 0) {
      ok(`Scholarship pagado: ${usdtPaid} USDT + ${slearnPaid} SLEARN (tx ${String(checkData.scholarshipResult || '').slice(0, 10)}...)`)
    } else if (hasTx && !fieldsPresent) {
      skip(`El servidor NO devuelve scholarshipUsdt/Slearn (versión desplegada sin el cambio del motor) — tx ${String(checkData.scholarshipResult).slice(0, 10)}... — requiere redeploy del sitio dev`)
      finish()
    } else if (msg.includes('need at least 50') || msg.includes('atLeast50')) {
      fail(`Sin beca: score insuficiente — ${msg.split('\n')[0]}`)
      finish()
    } else if (msg.includes('cooldown') || msg.includes('24 hours') || msg.includes('already paid')) {
      skip(`Sin beca nueva: ${msg.split('\n')[0]} — no se puede verificar el desembolso`)
      finish()
    } else if (checkData.error) {
      fail(`check-crossword error: ${JSON.stringify(checkData)}`)
      finish()
    } else {
      fail(`Sin beca y sin error claro: "${msg.slice(0, 120)}" (tx=${String(checkData.scholarshipResult || '')} — ¿vault del curso 2 sin fondos en dev?)`)
      finish()
    }

    // ════════════════════════════════════════════════════════════
    // 6. Historial del referidor → reward 10% registrada (desembolso real)
    // ════════════════════════════════════════════════════════════
    console.log('── 6. Historial del referidor: reward 10% ──')
    const expectedUsdt = Math.round(usdtPaid * 0.1 * 100) / 100
    const expectedSlearn = Math.round(slearnPaid * 0.1 * 100) / 100

    const hist = await apiGet('/api/referral/history',
      { walletAddress: referrerAddr, token: referrer.token }, referrer.cookies)

    const reward = (hist.rewards || []).find((r) =>
      r.type === 'referral_reward' &&
      Number(r.metadata?.referred_id) === referredUserId &&
      Number(r.metadata?.course_id) === COURSE_ID &&
      Number(r.metadata?.guide_id) === GUIDE_NUMBER,
    )
    if (!reward) {
      const seen = (hist.rewards || []).map(r => `${r.type}:${r.crypto}:${r.amount}:ref${r.metadata?.referred_id}`).join(' | ') || '(sin rewards)'
      fail(`No se encontró la reward del referido. Rewards del referidor: ${seen}`)
      finish()
    }
    const paidUsdt = reward.crypto === 'usdt' ? Number(reward.amount) : 0
    const paidSlearn = reward.crypto === 'slearn' ? Number(reward.amount) : 0
    ok(`Reward registrada: ${paidUsdt} USDT + ${paidSlearn} SLEARN (10% de ${usdtPaid}/${slearnPaid})`)
    if (Math.abs(paidUsdt - expectedUsdt) < 0.001 && Math.abs(paidSlearn - expectedSlearn) < 0.001) {
      ok(`Cuantía correcta: 10% (${expectedUsdt} USDT + ${expectedSlearn} SLEARN)`)
    } else {
      fail(`Cuantía inesperada: esperaba ${expectedUsdt} USDT + ${expectedSlearn} SLEARN`)
    }
    if (reward.subcategoria === 'referrer') ok('subcategoria "referrer" (no pastor_bonus)')
    else fail(`subcategoria inesperada: ${reward.subcategoria}`)

    // Idempotencia: solo UNA reward por relación/curso/guía
    const dupes = (hist.rewards || []).filter((r) =>
      r.type === 'referral_reward' &&
      Number(r.metadata?.referred_id) === referredUserId &&
      Number(r.metadata?.course_id) === COURSE_ID &&
      Number(r.metadata?.guide_id) === GUIDE_NUMBER,
    )
    if (dupes.length === 1) ok('Idempotente: 1 sola reward para esta relación/curso/guía')
    else fail(`Idempotencia rota: ${dupes.length} rewards`)

    // ════════════════════════════════════════════════════════════
    // 7. Notificación al referidor (acción + valor pagado)
    // ════════════════════════════════════════════════════════════
    console.log('── 7. Notificación al referidor ──')
    const notif = await apiGet('/api/notifications',
      { walletAddress: referrerAddr, token: referrer.token }, referrer.cookies)
    const rewardNotif = (notif.notifications || []).find((n) =>
      n.type === 'referral_reward' &&
      String(n.content || '').includes(`${expectedUsdt.toFixed(2)} USDT`) &&
      String(n.content || '').includes(`${expectedSlearn.toFixed(2)} SLEARN`))
    if (rewardNotif) {
      ok(`Notificación referral_reward: "${rewardNotif.title}"`)
      const content = String(rewardNotif.content || '')
      if (content.includes('paid') || content.includes('pagada')) ok(`Contenido: ${content.slice(0, 140)}`)
      else fail(`Contenido sin estado de pago: "${content.slice(0, 140)}"`)
      if (rewardNotif.link && String(rewardNotif.link).includes('celoscan')) ok('Enlace al explorador de la tx')
      else fail(`Enlace inesperado: ${rewardNotif.link}`)
    } else {
      fail(`Sin notificación referral_reward con el valor ${expectedUsdt.toFixed(2)} USDT + ${expectedSlearn.toFixed(2)} SLEARN. Notifs: ${JSON.stringify((notif.notifications || []).map(n => n.type + ':' + n.title)).slice(0, 200)}`)
    }
  } catch (e) {
    fail(`Error inesperado: ${e.message}`)
    if (e.response) console.log(`   Response: ${JSON.stringify(e.response.data)?.slice(0, 300)}`)
  }

  function finish() { console.log(`\n${passed}/${passed + failed} passed · ${skipped} skipped — ${failed} failed\n`); process.exit(failed > 0 ? 1 : 0) }

  finish()
}

main().catch(err => { console.error('[ERROR]', err.message); process.exit(1) })
