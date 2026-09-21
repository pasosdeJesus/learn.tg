#!/usr/bin/env node
// Diagnóstico https://github.com/pasosdeJesus/learn.tg/issues/229: el PATCH de iglesia (verificador) ya no debe fallar con
// `null value in column "pastor_whatsapp" violates not-null constraint` al
// guardar cambios. Simula el payload del formulario con pastor_whatsapp vacío.
//
// Uso: node e2e/diag/church-patch-check.mjs   (cwd apps/nextjs)
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
      const addr = c.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
})()
if (!creds) { console.error('no PRIVATE_KEY/NEXT_PUBLIC_ADDRESS'); process.exit(1) }
const account = privateKeyToAccount(creds.pk)

function mergeCookies(current, setCookieHeaders = []) {
  const map = new Map()
  if (current) current.split(';').forEach(c => { const [n, ...r] = c.trim().split('='); if (n && r.length) map.set(n, `${n}=${r.join('=')}`) })
  for (const h of setCookieHeaders || []) { const c = h.split(';')[0].trim(); const [n, ...r] = c.split('='); if (n && r.length) map.set(n, c) }
  return [...map.values()].join('; ')
}

async function siweLogin() {
  const csrfRes = await fetch(`${SITE}/api/auth/csrf`)
  const { csrfToken } = await csrfRes.json()
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
  console.log(`login: callback ${cb.status} (cookie de sesión)`)
  return { cookies: c2 }
}

async function main() {
  const { cookies } = await siweLogin()
  const q = `wallet=${encodeURIComponent(account.address)}`

  const listRes = await fetch(`${SITE}/api/admin/churches?${q}`, { headers: { Cookie: cookies } })
  const list = await listRes.json()
  const id = list?.churches?.[0]?.id
  if (!id) { console.error('sin iglesias para probar'); process.exit(1) }

  const detRes = await fetch(`${SITE}/api/admin/church/${id}?${q}`, { headers: { Cookie: cookies } })
  const det = await detRes.json()
  console.log(`iglesia ${id}: name="${det.name}" pastor_whatsapp="${det.pastor_whatsapp}"`)

  // Payload como el formulario del verificador: pastor_whatsapp vacío.
  const payload = {
    name: det.name,
    pastor_name: det.pastor_name || '',
    pastor_whatsapp: '',
    pastor_telegram: det.pastor_telegram || '',
    city_name: det.city_name || '',
    denomination: det.denomination || '',
    registration: det.registration || '',
    registration_verified: !!det.registration_verified,
  }
  const res = await fetch(`${SITE}/api/admin/church/${id}?${q}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify(payload),
  })
  const txt = await res.text()
  console.log(`PATCH name (pastor_whatsapp vacío): ${res.status} ${txt.slice(0, 200).replace(/\s+/g, ' ')}`)
  if (res.status !== 200) { console.error('❌ https://github.com/pasosdeJesus/learn.tg/issues/229 NO resuelto'); process.exit(1) }

  const det2Res = await fetch(`${SITE}/api/admin/church/${id}?${q}`, { headers: { Cookie: cookies } })
  const det2 = await det2Res.json()
  console.log(`verificación: name="${det2.name}" pastor_whatsapp="${det2.pastor_whatsapp}" (se conserva)`)
  if (det2.name !== det.name) { console.error('❌ el nombre no se conservó'); process.exit(1) }
  console.log('✅ https://github.com/pasosdeJesus/learn.tg/issues/229 OK (el PATCH con campos NOT NULL vacíos no rompe)')
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
