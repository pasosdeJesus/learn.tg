#!/usr/bin/env node
/**
 * Stress test de donaciones CELO nativas en PRODUCCIÓN (Celo mainnet) —
 * R-#224/R-#227. Reproduce la matriz del 401 por rotación de token:
 *   - 20 rondas de 0.01 CELO (verify POST con la "página" original).
 *   - En ROTATE_AT (default 6): login #2 de la misma billetera con jar aparte
 *     (simula otra pestaña/dispositivo) → rota el token en DB.
 *   - En DROP_COOKIE_ROUNDS (default "7,15"): la página envía el token VIEJO
 *     SIN cookie → 401 esperado (el mismo del reporte OneKey) → logs [auth].
 *   - El resto de rondas tras la rotación llevan token viejo CON cookie →
 *     200 vía session fallback.
 * Uso (autorizado por el operador, montos reales pequeños):
 *   SITE_URL=https://learn.tg CHAIN_ID=42220 node e2e/specs/donate-campaign-celo-prod-stress.spec.mjs
 */
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import { SiweMessage } from 'siwe'
import { createPublicClient, createWalletClient, http, formatEther, parseUnits } from 'viem'
import { celo } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

for (const p of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env')]) {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false })
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const SITE = process.env.SITE_URL || 'https://learn.tg'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '42220', 10)
const AMOUNT = parseUnits(process.env.AMOUNT_CELO || '0.01', 18)
const ROUNDS = parseInt(process.env.ROUNDS || '20', 10)
const ROTATE_AT = parseInt(process.env.ROTATE_AT || '6', 10)
const DROP_ROUNDS = (process.env.DROP_COOKIE_ROUNDS || '7,15').split(',').map(Number)
const CAMPAIGN_WALLET = '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07'

let passed = 0; let failed = 0
const ok = (m) => { passed++; console.log(`  [OK] ${m}`) }
const fail = (m) => { failed++; console.log(`  [FAIL] ${m}`) }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function loadCreds() {
  for (const envPath of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      if (pk) return pk
    }
  }
  return null
}
function mergeCookies(current, setCookieHeaders = []) {
  const map = new Map()
  if (current) current.split(';').forEach(c => { const [n, ...r] = c.trim().split('='); if (n && r.length) map.set(n, `${n}=${r.join('=')}`) })
  for (const h of setCookieHeaders || []) { const c = h.split(';')[0].trim(); const [n, ...r] = c.split('='); if (n && r.length) map.set(n, c) }
  return [...map.values()].join('; ')
}
async function siweLogin(account) {
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
  if (cb.status !== 200 && cb.status !== 302) throw new Error(`SIWE callback ${cb.status}`)
  return { cookies: mergeCookies(cookies, cb.headers.getSetCookie?.() || []), token: csrfToken }
}
async function rpcRetry(fn, retries = 8) {
  let last
  for (let i = 0; i < retries; i++) { try { return await fn() } catch (e) { last = e; await sleep(2500) } }
  throw last
}

async function main() {
  console.log(`STRESS donaciones CELO prod — ${ROUNDS} rondas x ${formatEther(AMOUNT)} CELO | ${SITE} (chain ${CHAIN_ID})\n`)
  const pk = loadCreds(); if (!pk) { console.error('no PRIVATE_KEY'); process.exit(1) }
  const account = privateKeyToAccount(pk)
  const rpcs = [...new Set(['https://forno.celo.org', 'https://celo.drpc.org', 'https://celo-rpc.publicnode.com', process.env.NEXT_PUBLIC_CELO_RPC_URL])].filter(Boolean)
  let pub = null, wc = null
  for (const url of rpcs) {
    try {
      const c = createPublicClient({ chain: celo, transport: http(url, { timeout: 20000 }) })
      await c.getBalance({ address: account.address }); pub = c
      wc = createWalletClient({ account, chain: celo, transport: http(url, { timeout: 20000 }) })
      console.log(`  RPC: ${url}`); break
    } catch { /* siguiente */ }
  }
  if (!pub) { console.error('sin RPC'); process.exit(1) }

  let backendWallet = process.env.BACKEND_ADDRESS || ''
  // En dev (billetera única) el backend se descubre vía churches/fund; en
  // mainnet cada rol tiene billetera propia → BACKEND_ADDRESS es obligatorio.
  if (!backendWallet && SITE.includes(':9001')) {
    try {
      const fd = await (await fetch(`${SITE}/api/churches/fund`)).json()
      if (fd?.address) backendWallet = fd.address
    } catch {}
  }
  if (!backendWallet) { console.error('BACKEND_ADDRESS requerido en producción (backend de donaciones)'); process.exit(1) }
  console.log(`  Backend wallet: ${backendWallet} | Donor: ${account.address}\n`)

  const donor0 = await rpcRetry(() => pub.getBalance({ address: account.address }))
  const camp0 = await rpcRetry(() => pub.getBalance({ address: CAMPAIGN_WALLET }))
  const need = AMOUNT * BigInt(ROUNDS) + parseUnits('0.1', 18)
  if (donor0 < need) { console.error(`Saldo insuficiente: ${formatEther(donor0)} < ${formatEther(need)}`); process.exit(1) }
  ok(`saldo donante ${formatEther(donor0)} CELO (requiere ≈${formatEther(need)})`)

  // "Página" del usuario: sesión original (token + cookie que se quedan viejos)
  const page = await siweLogin(account)
  ok(`login #1 (página) token=${page.token.slice(0, 8)}…`)

  for (let i = 1; i <= ROUNDS; i++) {
    if (i === ROTATE_AT) {
      await siweLogin(account) // login #2 jar aparte → rota token en DB
      ok(`login #2 en ronda ${i} (rota token; la página conserva el viejo + cookie)`)
      await sleep(2000)
    }
    const withCookie = !DROP_ROUNDS.includes(i)
    try {
      const tx = await rpcRetry(() => wc.sendTransaction({ to: backendWallet, value: AMOUNT }))
      const rc = await rpcRetry(() => pub.waitForTransactionReceipt({ hash: tx }))
      if (rc.status !== 'success') { fail(`ronda ${i}: tx falló`); continue }
      const res = await fetch(`${SITE}/api/donations/lensenia/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(withCookie ? { Cookie: page.cookies } : {}) },
        body: JSON.stringify({ walletAddress: account.address, token: page.token, usdtHash: tx, payToken: 'celo', receiveCashback: false, pdjSharePct: 0 }),
      })
      const body = await res.text()
      const expectFail = i > ROTATE_AT && !withCookie
      const tag = withCookie ? 'con cookie' : 'SIN cookie'
      if (res.status === 200) {
        ok(`ronda ${i} (${tag}): verify 200`)
      } else {
        const msg = body.slice(0, 140).replace(/\s+/g, ' ')
        if (expectFail) ok(`ronda ${i} (${tag}): verify ${res.status} ESPERADO (token viejo sin cookie) — ${msg}`)
        else fail(`ronda ${i} (${tag}): verify ${res.status} — ${msg}`)
      }
    } catch (e) {
      fail(`ronda ${i}: ${e?.shortMessage || e?.message || String(e)}`)
    }
    await sleep(2000 + Math.random() * 3000)
  }

  const donor1 = await rpcRetry(() => pub.getBalance({ address: account.address }))
  const camp1 = await rpcRetry(() => pub.getBalance({ address: CAMPAIGN_WALLET }))
  console.log(`\nDonante: ${formatEther(donor0)} → ${formatEther(donor1)} CELO (-${formatEther(donor0 - donor1)})`)
  console.log(`Campaña: ${formatEther(camp0)} → ${formatEther(camp1)} CELO (+${formatEther(camp1 - camp0)})`)
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
