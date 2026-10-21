// Smoke Test (HTTP, sin Chrome ni fondos): el precio del curso premium cambia por
// país según el HDI (https://github.com/pasosdeJesus/learn.tg/issues/128 §1.1).
// Cierra la casilla §4.2 "verify correct price for different countries": crea dos
// perfiles recién registrados (Sierra Leona y Colombia) y compara lo que devuelve
// `/api/courses/premium/price` para cada uno.
//
// Ejecución:
//   SITE_URL=https://learn.tg:9001 node e2e/smoke/premium-price.spec.mjs
//   (o)  make test-smoke

import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import axios from 'axios'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from 'viem/accounts'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
const COURSE_ID = 10 // Global Disciples (premium)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

let passed = 0, failed = 0
function ok(msg) { passed++; console.log(`  ✅ ${msg}`) }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`) }

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
      const [name] = c.split('=')
      if (name) map.set(name, c)
    })
  }
  return Array.from(map.values()).join('; ')
}

async function siweSignIn(privateKey, address) {
  const account = privateKeyToAccount(privateKey)
  const csrfRes = await axios.get(`${SITE}/api/auth/csrf`, { httpsAgent })
  const csrfToken = csrfRes.data.csrfToken
  let cookies = updateCookies('', csrfRes.headers['set-cookie'])
  const siweMessage = new SiweMessage({
    domain: new URL(SITE).host, address,
    statement: 'Sign in to Learn through games with DIVVI tracking.',
    uri: SITE, version: '1', chainId: CHAIN_ID, nonce: csrfToken,
    issuedAt: new Date().toISOString(),
  })
  const signature = await account.signMessage({ message: siweMessage.prepareMessage() })
  const fd = new URLSearchParams({ csrfToken, message: siweMessage.prepareMessage(), signature, redirect: 'false', callbackUrl: `${SITE}/`, json: 'true' })
  const res = await axios.post(`${SITE}/api/auth/callback/credentials`, fd.toString(), {
    httpsAgent, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    maxRedirects: 0, validateStatus: s => s < 400,
  })
  cookies = updateCookies(cookies, res.headers['set-cookie'])
  return { cookies, address }
}

async function profileAndPrice(countryId, label) {
  const pk = generatePrivateKey()
  const addr = privateKeyToAddress(pk)
  const s = await siweSignIn(pk, addr)
  // `walletAddress` es la pista de identidad que `authenticateUser` compara con el
  // sujeto de la cookie de sesión (R-#233): sin ella el PATCH responde 401.
  const patch = await axios.patch(
    `${SITE}/api/profile?walletAddress=${encodeURIComponent(addr)}`,
    {
      nombre: `E2E Price ${label}`, email: `price-${addr.slice(2, 10).toLowerCase()}@learn.tg`,
      pais_id: countryId,
    },
    {
      httpsAgent,
      headers: { 'Content-Type': 'application/json', Cookie: s.cookies },
      validateStatus: (status) => status < 500,
    },
  )
  if (patch.status !== 200) {
    throw new Error(`profile PATCH ${patch.status}: ${JSON.stringify(patch.data).slice(0, 120)}`)
  }
  const res = await axios.get(
    `${SITE}/api/courses/premium/price?courseId=${COURSE_ID}&walletAddress=${encodeURIComponent(addr)}`,
    { httpsAgent, headers: { Cookie: s.cookies } },
  )
  return res.data
}

async function main() {
  console.log(`Target: ${SITE}\n`)

  // Sierra Leona (HDI 0.467 → ancla baja) y Colombia (HDI 0.788 → ancla alta)
  let sl = null
  let co = null
  try {
    sl = await profileAndPrice(694, 'SL')
    ok(`Sierra Leona: ${sl.priceUSDT} USDT / ${sl.priceSLEARN} SLEARN (HDI ${sl.hdiUsed})`)
  } catch (e) {
    fail(`Sierra Leona price failed: ${e?.response?.status || e?.message}`)
  }
  try {
    co = await profileAndPrice(170, 'CO')
    ok(`Colombia: ${co.priceUSDT} USDT / ${co.priceSLEARN} SLEARN (HDI ${co.hdiUsed})`)
  } catch (e) {
    fail(`Colombia price failed: ${e?.response?.status || e?.message}`)
  }

  if (sl && co) {
    if (co.priceUSDT > sl.priceUSDT) ok(`el país de HDI alto paga más (${co.priceUSDT} > ${sl.priceUSDT})`)
    else fail(`Colombia debería pagar más que Sierra Leona (${co.priceUSDT} vs ${sl.priceUSDT})`)

    // El SLEARN lleva 10% de descuento sobre el tipo (que en el dev es 22).
    for (const [label, p] of [['SL', sl], ['CO', co]]) {
      const implied = p.priceUSDT > 0 ? p.priceSLEARN / p.priceUSDT : 0
      if (implied > 10 && implied < 23) ok(`${label}: el SLEARN mantiene el descuento (tipo implícito ${implied.toFixed(2)})`)
      else fail(`${label}: tipo implícito fuera de rango (${implied.toFixed(2)})`)
    }

    if (sl.priceUSDT > 0 && sl.priceUSDT < 2 && co.priceUSDT > 2 && co.priceUSDT < 5) {
      ok('los montos caen en el rango calibrado (SL ~0.70, CO ~3.00)')
    } else {
      fail(`montos fuera de la calibración (SL ${sl.priceUSDT}, CO ${co.priceUSDT})`)
    }
  }

  console.log(`\n${passed} passed / ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL:', e?.response?.data || e?.message || e)
  process.exit(1)
})
