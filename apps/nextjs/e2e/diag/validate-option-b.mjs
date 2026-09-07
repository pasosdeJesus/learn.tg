#!/usr/bin/env node
// Valida Opción B R-#227 en dev: tras el SIWE, /api/auth/token devuelve el
// token DEDICADO (≠ CSRF); con cookie → 200 (session-first); token dedicado
// sin cookie → 401 (AUTH_SESSION_ONLY=1 deshabilita legacy).
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

const pk = (() => { for (const p of ['../.env', 'apps/.env', '.env']) { const f = path.join(process.cwd(), p); if (fs.existsSync(f)) { const c = fs.readFileSync(f, 'utf8'); const m = c.match(/PRIVATE_KEY="([^"]+)"/) || c.match(/PRIVATE_KEY=(\S+)/); if (m) return m[1] } } return null })()
if (!pk) { console.error('no PRIVATE_KEY'); process.exit(1) }
const account = privateKeyToAccount(pk)

function mergeCookies(current, setCookieHeaders = []) {
  const map = new Map()
  if (current) current.split(';').forEach(c => { const [n, ...r] = c.trim().split('='); if (n && r.length) map.set(n, `${n}=${r.join('=')}`) })
  for (const h of setCookieHeaders || []) { const c = h.split(';')[0].trim(); const [n, ...r] = c.split('='); if (n && r.length) map.set(n, c) }
  return [...map.values()].join('; ')
}
async function main() {
  console.log(`Opción B — ${account.address} | ${SITE} (chain ${CHAIN_ID})\n`)
  const csrfRes = await fetch(`${SITE}/api/auth/csrf`)
  const { csrfToken } = await csrfRes.json()
  const cookies = mergeCookies('', csrfRes.headers.getSetCookie?.() || [])
  const host = new URL(SITE).hostname
  const port = new URL(SITE).port || '443'
  const dp = port === '443' || port === '80' ? '' : `:${port}`
  const msg = new SiweMessage({ domain: `${host}${dp}`, address: account.address, statement: 'Sign in to Learn through games.', uri: SITE, version: '1', chainId: CHAIN_ID, nonce: csrfToken })
  const sig = await account.signMessage({ message: msg.prepareMessage() })
  const cb = await fetch(`${SITE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    body: new URLSearchParams({ csrfToken, message: msg.prepareMessage(), signature: typeof sig === 'string' ? sig : sig.signature || String(sig), redirect: 'false', json: 'true' }).toString(),
    redirect: 'manual',
  })
  const cookies2 = mergeCookies(cookies, cb.headers.getSetCookie?.() || [])
  console.log(`SIWE callback: ${cb.status}`)

  // 1) GET /api/auth/token (sesión) → token dedicado
  const tokRes = await fetch(`${SITE}/api/auth/token`, { headers: { Accept: 'application/json', Cookie: cookies2 } })
  const tokData = await tokRes.json()
  console.log(`/api/auth/token con cookie → ${tokRes.status} token:${tokData.token ? tokData.token.slice(0, 16) + '…' : 'NA'} (len ${tokData.token ? tokData.token.length : 0})`)
  console.log(`¿CSRF != token dedicado? ${csrfToken !== tokData.token}`)
  const dedicated = tokData.token

  // 2) profile con cookie (sesión) → 200
  let r = await fetch(`${SITE}/api/profile?walletAddress=${account.address}&token=${encodeURIComponent(csrfToken)}`, { headers: { Cookie: cookies2 } })
  console.log(`profile cookie + csrf → ${r.status}`)

  // 3) profile token dedicado SIN cookie → 401 (AUTH_SESSION_ONLY)
  r = await fetch(`${SITE}/api/profile?walletAddress=${account.address}&token=${encodeURIComponent(dedicated)}`)
  console.log(`profile token dedicado SIN cookie → ${r.status} (esperado 401 con AUTH_SESSION_ONLY=1)`)

  // 4) profile token dedicado CON cookie → 200 (session-first)
  r = await fetch(`${SITE}/api/profile?walletAddress=${account.address}&token=${encodeURIComponent(dedicated)}`, { headers: { Cookie: cookies2 } })
  console.log(`profile token dedicado CON cookie → ${r.status}`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
