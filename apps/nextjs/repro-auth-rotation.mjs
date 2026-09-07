#!/usr/bin/env node
// Repro diagnóstico R-224/R-227 (dev): rotación de token por segundo login de la
// misma billetera y qué camino de authenticateUser responde.
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import { SiweMessage } from 'siwe'
import { privateKeyToAccount } from 'viem/accounts'

for (const p of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env')]) {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false })
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)

const creds = (() => {
  for (const p of ['../.env', 'apps/.env', '.env']) {
    const full = path.join(process.cwd(), p)
    if (fs.existsSync(full)) {
      const c = fs.readFileSync(full, 'utf8')
      const pk = c.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || c.match(/PRIVATE_KEY=(\S+)/)?.[1]
      if (pk) return pk
    }
  }
  return null
})()
if (!creds) { console.error('no PRIVATE_KEY'); process.exit(1) }
const account = privateKeyToAccount(creds)

function mergeCookies(current, setCookieHeaders = []) {
  const map = new Map()
  if (current) current.split(';').forEach(c => { const [n, ...r] = c.trim().split('='); if (n && r.length) map.set(n, `${n}=${r.join('=')}`) })
  for (const h of setCookieHeaders || []) { const c = h.split(';')[0].trim(); const [n, ...r] = c.split('='); if (n && r.length) map.set(n, c) }
  return [...map.values()].join('; ')
}

async function siweLogin(label) {
  let csrfRes, csrfToken
  for (let i = 0; i < 4; i++) {
    csrfRes = await fetch(`${SITE}/api/auth/csrf`)
    if (csrfRes.ok) { ({ csrfToken } = await csrfRes.json()); break }
    console.log(`${label}: csrf ${csrfRes.status} (intento ${i + 1}) — ${(await csrfRes.text()).slice(0, 100)}`)
    await new Promise(r => setTimeout(r, 1500))
  }
  if (!csrfToken) { console.error('csrf falló'); process.exit(1) }
  const cookies = mergeCookies('', csrfRes.headers.getSetCookie?.() || [])
  const host = new URL(SITE).hostname
  const port = new URL(SITE).port || '443'
  const dp = port === '443' || port === '80' ? '' : `:${port}`
  const msg = new SiweMessage({ domain: `${host}${dp}`, address: account.address, statement: 'Sign in to Learn through games.', uri: SITE, version: '1', chainId: CHAIN_ID, nonce: csrfToken })
  const msgStr = msg.prepareMessage()
  const sig = await account.signMessage({ message: msgStr })
  const body = new URLSearchParams({ csrfToken, message: msgStr, signature: typeof sig === 'string' ? sig : sig.signature || String(sig), redirect: 'false', json: 'true' })
  const cb = await fetch(`${SITE}/api/auth/callback/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies }, body: body.toString(), redirect: 'manual' })
  const c2 = mergeCookies(cookies, cb.headers.getSetCookie?.() || [])
  console.log(`${label}: callback ${cb.status}${cb.status === 302 ? ' (ok)' : ''} | cookies:${c2.split(';').length} | token:${csrfToken.slice(0, 10)}…`)
  return { cookies: c2, token: csrfToken }
}

async function authedGet(label, token, cookies) {
  const url = `${SITE}/api/profile?walletAddress=${account.address}&token=${encodeURIComponent(token)}`
  const res = await fetch(url, { headers: cookies ? { Cookie: cookies } : {} })
  const txt = await res.text()
  console.log(`${label}: ${res.status} ${txt.slice(0, 120).replace(/\s+/g, ' ')}`)
}

async function main() {
  console.log(`Wallet: ${account.address} | ${SITE} (chain ${CHAIN_ID})\n`)
  const s1 = await siweLogin('session #1')
  const s2 = await siweLogin('session #2 (misma billetera → rota token en DB)')
  console.log(`\ntoken1 == token2 ? ${s1.token === s2.token}\n`)
  // a) token viejo (rotado) + cookie de la sesión 1 → ¿fallback por cookie?
  await authedGet('A) token#1 viejo CON cookie sesión#1', s1.token, s1.cookies)
  // b) token viejo sin cookie (otra pestaña/dispositivo sin cookie jar)
  await authedGet('B) token#1 viejo SIN cookie', s1.token, '')
  // c) token#2 vigente con su cookie → control
  await authedGet('C) token#2 vigente CON cookie sesión#2', s2.token, s2.cookies)
  // d) token#2 vigente SIN cookie → con AUTH_SESSION_ONLY=1 debe ser 401 (legacy off)
  await authedGet('D) token#2 vigente SIN cookie (AUTH_SESSION_ONLY esperado=401)', s2.token, '')
  // d) sesión: qué dice /api/auth/session con cookie 1
  const sess = await fetch(`${SITE}/api/auth/session`, { headers: { Cookie: s1.cookies } })
  console.log(`\nsession cookie#1 → /api/auth/session: ${sess.status} ${(await sess.text()).slice(0, 160)}`)
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
