#!/usr/bin/env node

/**
 * Smoke test E2E: corrección del referidor desde el admin
 * (https://github.com/pasosdeJesus/learn.tg/issues/163 §7.1)
 *
 * Verifica en el sitio desplegado que el verificador puede **leer y corregir** el
 * referidor de un estudiante sin tocar la base de datos:
 *
 *   1. SIWE como la billetera verificadora de `apps/.env`
 *   2. Lectura: un usuario con referidor declarado → código propio, "referido por" y
 *      recompensas ya pagadas a ese referidor
 *   3. Validaciones: auto-referencia → 400; referidor inexistente → 400
 *   4. Sin cambio: enviar el referidor actual → 200 con el mismo referidor
 *   5. Ida y vuelta: cambiar a otro referidor y **restaurar el original**
 *      (`referralrelationship` es único por referido; el cambio queda en
 *      `verification_log` con `action='update_referrer'`)
 *
 * El spec NO deja datos cambiados: el paso 5 siempre revierte, y si la reversión
 * falla lo reporta como fallo (nunca se queda con el referidor cambiado).
 *
 * SKIP (no falla) cuando el sitio no permite la prueba:
 *   - la billetera de `apps/.env` no es verificadora allí (403 en la API admin), o
 *   - ningún usuario reciente tiene referidor declarado (lo crea
 *     `referral-program.spec.mjs`), o
 *   - no hay un usuario alterno válido para el ida y vuelta (el referidor no puede
 *     ser más nuevo que el referido).
 *
 * Ejecución:
 *   bin/m test:e2e admin-referrer --smoke
 *   o: SITE_URL=https://learn.tg:9001 node e2e/smoke/admin-referrer.spec.mjs
 *
 * Prerrequisitos (sitio dev https://learn.tg:9001):
 *   - apps/.env: PRIVATE_KEY + NEXT_PUBLIC_ADDRESS (billetera verificadora)
 *   - Al menos un usuario con referidor en `referralrelationship`
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
let skipped = 0
function ok(msg) { passed++; console.log(`  [OK] ${msg}`) }
function fail(msg) { failed++; console.log(`  [FAIL] ${msg}`) }
function skip(msg) { skipped++; console.log(`  [SKIP] ${msg}`) }
function finish() {
  console.log(`\n${passed}/${passed + failed} passed · ${skipped} skipped — ${failed} failed\n`)
  process.exit(failed > 0 ? 1 : 0)
}

/** Lee PRIVATE_KEY y NEXT_PUBLIC_ADDRESS de apps/.env sin imprimir sus valores. */
function envValue(key) {
  for (const envPath of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), '.env'), path.join(process.cwd(), 'apps', '.env')]) {
    if (!fs.existsSync(envPath)) continue
    const content = fs.readFileSync(envPath, 'utf8')
    const m = content.match(new RegExp(`${key}="([^"]+)"`)) || content.match(new RegExp(`${key}=(\\S+)`))
    if (m) return m[1]
  }
  return null
}

// ── SIWE + API (mismo patrón que referral-payout.spec.mjs) ──────────────

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
    statement: 'Sign in to Learn through games.',
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
  return cookies
}

async function api(method, reqPath, { params, data, cookies } = {}) {
  const url = new URL(reqPath, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.request({
    url: url.toString(),
    method,
    data,
    httpsAgent,
    headers: { ...(cookies ? { Cookie: cookies } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
    validateStatus: () => true,
  })
  return { status: res.status, body: res.data }
}

async function main() {
  const t0 = Date.now()
  console.log(`\nAdmin: corrección del referidor | ${SITE}\n`)

  const pk = envValue('PRIVATE_KEY')
  const address = envValue('NEXT_PUBLIC_ADDRESS')
  if (!pk || !address) { fail('Faltan PRIVATE_KEY / NEXT_PUBLIC_ADDRESS en apps/.env'); finish() }

  let cookies = ''
  try {
    cookies = await siweSignIn(pk, address)
  } catch (e) {
    fail(`SIWE falló: ${e.message}`)
    finish()
  }
  ok(`Sesión SIWE como ${address.slice(0, 10)}…`)

  const params = { wallet: address }
  const session = await api('GET', '/api/auth/session', { cookies })
  if (session.body?.address) ok(`Sesión activa: ${session.body.address}`)
  else { fail(`Sin sesión: ${JSON.stringify(session.body)}`); finish() }

  // 1. Un usuario con referidor declarado (lo crea referral-program.spec.mjs).
  const recent = await api('GET', '/api/admin/users/recent', { params, cookies })
  if (recent.status === 403) { skip('La billetera de apps/.env no es verificadora en este sitio (403)'); finish() }
  if (recent.status !== 200) { fail(`/api/admin/users/recent → ${recent.status}`); finish() }
  const candidates = recent.body?.users || []
  if (!candidates.length) { skip('El sitio no devolvió usuarios recientes'); finish() }

  let target = null
  for (const u of candidates) {
    const detail = await api('GET', `/api/admin/user/${u.id}`, { params, cookies })
    if (detail.body?.referral?.referrer) { target = { id: u.id, nombre: u.nombre, referral: detail.body.referral }; break }
  }
  if (!target) {
    skip('Ningún usuario reciente tiene referidor declarado (corra referral-program.spec.mjs primero)')
    finish()
  }
  const original = target.referral.referrer.id
  ok(`Usuario ${target.id} (${target.nombre}): código propio ${target.referral.code || '(sin código)'}, referido por #${original} ${target.referral.referrer.nusuario || ''}, recompensas pagadas ${target.referral.rewards_paid?.count ?? 0}`)
  if (target.referral.code) ok('El código propio del usuario se expone para el verificador')
  else skip('El usuario aún no tiene código propio (se crea al primer uso)')

  const patch = (payload) => api('PATCH', `/api/admin/user/${target.id}`, { params, data: payload, cookies })

  // 2. Validaciones (no escriben nada).
  const self = await patch({ referrer: String(target.id) })
  if (self.status === 400 && /refer themselves/.test(self.body?.error || '')) ok(`Auto-referencia rechazada: ${self.body.error}`)
  else fail(`Auto-referencia: ${self.status} ${JSON.stringify(self.body)}`)

  const unknown = await patch({ referrer: 'nadie-existe-999' })
  if (unknown.status === 400 && /Referrer not found/.test(unknown.body?.error || '')) ok(`Referidor inexistente rechazado: ${unknown.body.error}`)
  else fail(`Referidor inexistente: ${unknown.status} ${JSON.stringify(unknown.body)}`)

  const same = await patch({ referrer: String(original) })
  if (same.status === 200 && same.body?.referral?.referrer?.id === original) ok('Repetir el referidor actual no cambia nada (200, mismo referidor)')
  else fail(`Repetir el referidor: ${same.status} ${JSON.stringify(same.body?.referral || same.body)}`)

  // 3. Ida y vuelta con reversión garantizada.
  const alternates = candidates
    .map(u => u.id)
    .filter(id => id !== target.id && id !== original)
    .slice(0, 5)
  if (!alternates.length) {
    skip('Sin candidato alterno para el ida y vuelta (se probaron las validaciones)')
  } else {
    let swapped = false
    let lastError = '(sin intento)'
    let alternative = null
    for (const id of alternates) {
      const res = await patch({ referrer: String(id) })
      if (res.status === 200 && res.body?.referral?.referrer?.id === id) {
        swapped = true
        alternative = id
        ok(`Cambio aplicado: referido por #${id} (upsert en referralrelationship + verification_log)`)
        break
      }
      lastError = `${res.status} ${res.body?.error || ''}`
    }

    if (!swapped) {
      skip(`Ningún alterno sirvió para el cambio (el referidor no puede ser más nuevo que el referido): ${lastError}`)
    }

    // Reversión: se intenta siempre, también si el cambio falló (pudo quedar a medias).
    const back = await patch({ referrer: String(original) })
    if (back.status === 200 && back.body?.referral?.referrer?.id === original) {
      ok(`Estado original restaurado (referido por #${original})`)
    } else {
      fail(`NO se pudo restaurar el referidor original (#${original}): ${back.status} ${JSON.stringify(back.body?.referral || back.body)} — el usuario ${target.id} quedó con el referidor ${alternative ?? 'desconocido'}`)
    }
  }

  const detail = await api('GET', `/api/admin/user/${target.id}`, { params, cookies })
  if (detail.body?.referral?.referrer?.id === original) ok('Verificación final: el usuario conserva su referidor original')
  else fail(`Verificación final: referidor ${detail.body?.referral?.referrer?.id} ≠ ${original}`)

  console.log(`  [i] ${(Date.now() - t0) / 1000}s`)
  finish()
}

main().catch(err => { console.error('[ERROR]', err.message); process.exit(1) })
