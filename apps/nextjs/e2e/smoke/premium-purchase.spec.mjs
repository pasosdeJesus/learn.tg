// Smoke de compra (HTTP, sin Chrome): recorre el camino del dinero de un curso
// premium de punta a punta —
//   precio → transferencias del usuario al backend → POST /api/courses/premium/purchase
//   → processPayment on-chain → acceso al curso → compra visible en `mine`.
// Cubre https://github.com/pasosdeJesus/learn.tg/issues/128 §4.2.
//
// GASTA FONDOS DE DESARROLLO (testnet), por eso está apagado por defecto: sin
// PURCHASE=1 solo comprueba precio y autenticación e informa el resto como saltado.
//
//   PURCHASE=1 SLEARN_PCT=0   …   # 100% USDT (necesita ~0.70 USDT)
//   PURCHASE=1 SLEARN_PCT=100 …   # 100% SLEARN (necesita 13.86 SLEARN para SL)
//   PURCHASE=1 SLEARN_PCT=50  …   # mixto (necesita ~6.93 SLEARN + 0.35 USDT)
//
// La wallet fixture (`apps/.env` PRIVATE_KEY) financia al pastor nuevo y paga el
// gas; se pide solo lo que la mezcla necesita (con 15% de margen).
//
// Ejecución:
//   SITE_URL=https://learn.tg:9001 PURCHASE=1 SLEARN_PCT=0 node e2e/smoke/premium-purchase.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import axios from 'axios'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, createWalletClient, http, parseEther, parseUnits } from 'viem'
import { celoSepolia } from 'viem/chains'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
const COURSE_ID = 10 // Global Disciples (premium)
const SLEARN_PCT = Number(process.env.SLEARN_PCT ?? '0') // 0 | 50 | 100
const PURCHASE = process.env.PURCHASE === '1'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

const ERC20 = [
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
]

let passed = 0, failed = 0
function ok(msg) { passed++; console.log(`  ✅ ${msg}`) }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`) }

function round2(n) { return Math.ceil(n * 100) / 100 }

function loadFixture() {
  for (const envPath of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]) {
    if (!fs.existsSync(envPath)) continue
    const c = fs.readFileSync(envPath, 'utf8')
    const g = (k) => c.match(new RegExp(`${k}="?([^"\\n]+)"?`))?.[1]
    const fixture = { pk: g('PRIVATE_KEY'), addr: g('NEXT_PUBLIC_ADDRESS'), usdt: g('NEXT_PUBLIC_USDT_ADDRESS'), slearn: g('NEXT_PUBLIC_SLEARN_ADDRESS'), rpc: g('NEXT_PUBLIC_RPC_URL') }
    if (fixture.pk && fixture.addr && fixture.usdt && fixture.slearn && fixture.rpc) return fixture
  }
  return null
}

function cookieHeader(res, current = '') {
  const map = new Map()
  current.split('; ').filter(Boolean).forEach((c) => map.set(c.split('=')[0], c))
  ;(res.headers['set-cookie'] || []).forEach((h) => {
    const pair = h.split(';')[0]
    map.set(pair.split('=')[0], pair)
  })
  return Array.from(map.values()).join('; ')
}

async function siweSignIn(pk, addr) {
  const account = privateKeyToAccount(pk)
  const csrf = await axios.get(`${SITE}/api/auth/csrf`, { httpsAgent })
  const csrfToken = csrf.data.csrfToken
  let cookies = cookieHeader(csrf)
  const message = new SiweMessage({
    domain: new URL(SITE).host, address: addr,
    statement: 'Sign in to Learn through games with DIVVI tracking.',
    uri: SITE, version: '1', chainId: CHAIN_ID, nonce: csrfToken,
    issuedAt: new Date().toISOString(),
  }).prepareMessage()
  const signature = await account.signMessage({ message })
  const fd = new URLSearchParams({ csrfToken, message, signature, redirect: 'false', callbackUrl: `${SITE}/`, json: 'true' })
  const res = await axios.post(`${SITE}/api/auth/callback/credentials`, fd.toString(), {
    httpsAgent, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    maxRedirects: 0, validateStatus: (s) => s < 400,
  })
  cookies = cookieHeader(res, cookies)
  return cookies
}

async function main() {
  console.log(`Target: ${SITE} | curso ${COURSE_ID} | ${SLEARN_PCT}% SLEARN | compra: ${PURCHASE ? 'sí' : 'no'}\n`)

  const fixture = loadFixture()
  if (!fixture) { console.error('FATAL: no hay apps/.env con PRIVATE_KEY/addresses'); process.exit(1) }

  // 1. Pastor nuevo de Sierra Leona (país piloto) elegible para comprar GD
  const pk = generatePrivateKey()
  const addr = privateKeyToAddress(pk)
  const cookies = await siweSignIn(pk, addr)
  const patch = await axios.patch(
    `${SITE}/api/profile?walletAddress=${encodeURIComponent(addr)}`,
    { nombre: 'E2E Purchase', email: `purchase-${addr.slice(2, 10).toLowerCase()}@learn.tg`, pais_id: 694, religion_id: 2, position_israel_gaza: 'no', place_of_worship: 'E2E Purchase Church', place_of_worship_location: 'Freetown', church_relationship: 'pastor' },
    { httpsAgent, headers: { 'Content-Type': 'application/json', Cookie: cookies }, validateStatus: (s) => s < 500 },
  )
  if (patch.status === 200) ok('Pastor de prueba creado y autenticado')
  else fail(`No se pudo preparar el pastor: PATCH ${patch.status} ${JSON.stringify(patch.data).slice(0, 80)}`)

  // El verificador confirma la ciudad de culto (requisito de todo curso de pago)
  const verifierCookies = await siweSignIn(fixture.pk, fixture.addr)
  const profile = await axios.get(`${SITE}/api/profile?walletAddress=${encodeURIComponent(addr)}`, { httpsAgent, headers: { Cookie: cookies } }).then((r) => r.data)
  const verified = await axios.patch(
    `${SITE}/api/admin/user/${profile.id}?wallet=${encodeURIComponent(fixture.addr)}`,
    { verified_place_of_worship_location: 'Freetown', verified_place_of_worship: 'E2E Purchase Church', verified_church_relationship: 'pastor' },
    { httpsAgent, headers: { 'Content-Type': 'application/json', Cookie: verifierCookies }, validateStatus: (s) => s < 500 },
  )
  if (verified.status === 200) ok('Ciudad de culto verificada (elegible para comprar)')
  else fail(`Verificación falló: PATCH ${verified.status}`)

  // 2. Precio real del curso para este pastor
  const priceRes = await axios.get(
    `${SITE}/api/courses/premium/price?courseId=${COURSE_ID}&walletAddress=${encodeURIComponent(addr)}`,
    { httpsAgent, headers: { Cookie: cookies }, validateStatus: (s) => s < 500 },
  )
  if (priceRes.status !== 200) { fail(`Precio no disponible: ${priceRes.status}`); return finish() }
  const { priceUSDT, priceSLEARN } = priceRes.data
  ok(`Precio: ${priceUSDT} USDT / ${priceSLEARN} SLEARN`)

  // El usuario paga al backend del sitio, no a la fixture local: en el dev site
  // todos los roles colapsan en una sola billetera, que `/api/churches/fund`
  // publica. `BACKEND_ADDRESS` permite forzarla en otro despliegue.
  let backendAddress = process.env.BACKEND_ADDRESS
  if (!backendAddress) {
    const fund = await axios.get(`${SITE}/api/churches/fund`, { httpsAgent, validateStatus: (s) => s < 500 })
    backendAddress = fund.data?.address
  }
  if (!backendAddress) { fail('No se pudo resolver la billetera del backend'); return finish() }
  console.log(`  [backend] pagos a ${backendAddress}`)

  const usdtAmount = round2(priceUSDT * ((100 - SLEARN_PCT) / 100))
  const slearnAmount = round2(priceSLEARN * (SLEARN_PCT / 100))
  console.log(`  [mix] ${SLEARN_PCT}% SLEARN → pagar ${usdtAmount} USDT + ${slearnAmount} SLEARN`)

  if (!PURCHASE) {
    console.log('  [SKIP] pasos de compra (usa PURCHASE=1 para ejecutarlos; gastan fondos de prueba)')
    return finish()
  }

  // 3. Financiar al pastor nuevo desde la fixture (solo lo necesario + 15%)
  const read = createPublicClient({ chain: celoSepolia, transport: http(fixture.rpc) })
  const wallet = createWalletClient({ account: privateKeyToAccount(fixture.pk), chain: celoSepolia, transport: http(fixture.rpc) })
  const needUsdt = Math.max(round2(usdtAmount * 1.15), 0.5)
  const needSlearn = round2(slearnAmount * 1.15)
  const [haveUsdt, haveSlearn] = await Promise.all([
    read.readContract({ address: fixture.usdt, abi: ERC20, functionName: 'balanceOf', args: [fixture.addr] }),
    read.readContract({ address: fixture.slearn, abi: ERC20, functionName: 'balanceOf', args: [fixture.addr] }),
  ])
  const fUsdt = Number(haveUsdt) / 1e6
  const fSlearn = Number(haveSlearn) / 100
  if (fUsdt < needUsdt || fSlearn < needSlearn) {
    console.log(`  [SKIP] la fixture no alcanza: tiene ${fUsdt.toFixed(2)} USDT / ${fSlearn.toFixed(2)} SLEARN, necesita ${needUsdt} / ${needSlearn}`)
    return finish()
  }
  // Las transferencias van en secuencia esperando cada recibo: sin eso la segunda
  // reutiliza el nonce de la primera y el RPC la rechaza ("nonce too low"), que fue
  // el fallo medido el 2026-09-21.
  const send = async (label, fn) => {
    const hash = await fn()
    const receipt = await read.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error(`${label} falló on-chain (${hash})`)
    return hash
  }
  await send('gas', () => wallet.sendTransaction({ to: addr, value: parseEther('0.05') }))
  await send('USDT a la fixture', () => wallet.writeContract({ address: fixture.usdt, abi: ERC20, functionName: 'transfer', args: [addr, parseUnits(String(needUsdt), 6)] }))
  if (needSlearn > 0) {
    await send('SLEARN a la fixture', () => wallet.writeContract({ address: fixture.slearn, abi: ERC20, functionName: 'transfer', args: [addr, parseUnits(String(needSlearn), 2)] }))
  }
  ok(`Pastor financiado desde la fixture (${needUsdt} USDT, ${needSlearn} SLEARN)`)
  await new Promise((r) => setTimeout(r, 8000))

  // 4. El usuario transfiere al backend y publica los hashes
  const userWallet = createWalletClient({ account: privateKeyToAccount(pk), chain: celoSepolia, transport: http(fixture.rpc) })
  let usdtHash = null
  let slearnHash = null
  if (usdtAmount > 0) {
    usdtHash = await send('USDT al backend', () => userWallet.writeContract({ address: fixture.usdt, abi: ERC20, functionName: 'transfer', args: [backendAddress, parseUnits(String(usdtAmount), 6)] }))
  }
  if (slearnAmount > 0) {
    slearnHash = await send('SLEARN al backend', () => userWallet.writeContract({ address: fixture.slearn, abi: ERC20, functionName: 'transfer', args: [backendAddress, parseUnits(String(slearnAmount), 2)] }))
  }
  ok('Transferencias del pastor al backend hechas')
  await new Promise((r) => setTimeout(r, 8000))

  const purchase = await axios.post(
    `${SITE}/api/courses/premium/purchase?walletAddress=${encodeURIComponent(addr)}`,
    // `walletAddress` va también en el body: el motor lo lee de ahí (es la pista de
    // identidad que `authenticateUser` compara con el sujeto de la sesión); en el
    // navegador lo inyecta `useAuthedApi`.
    { walletAddress: addr, courseId: COURSE_ID, usdtHash: usdtHash || undefined, slearnHash: slearnHash || undefined },
    { httpsAgent, headers: { 'Content-Type': 'application/json', Cookie: cookies }, validateStatus: (s) => s < 500 },
  )
  const body = purchase.data || {}
  if (purchase.status === 200 && body.processPaymentHash) {
    ok(`Compra procesada on-chain (${String(body.processPaymentHash).slice(0, 12)}…)`)
  } else {
    fail(`Compra falló: ${purchase.status} ${JSON.stringify(body).slice(0, 160)}`)
    return finish()
  }

  if (Array.isArray(body.distribution) && body.distribution.length > 0) {
    const total = body.distribution.reduce((sum, d) => sum + Number(d.amount || 0), 0)
    ok(`Distribución devuelta (${body.distribution.length} destinos, ${total.toFixed(2)} en total)`)
  } else {
    fail('La respuesta no trae la distribución')
  }

  // 5. Acceso al curso y compra en `mine`
  const access = await axios.get(`${SITE}/api/courses/${COURSE_ID}/access?walletAddress=${encodeURIComponent(addr)}`, { httpsAgent, headers: { Cookie: cookies }, validateStatus: (s) => s < 500 })
  if (access.status === 200 && access.data?.access === true) ok('Acceso al curso concedido tras la compra')
  else fail(`Sin acceso tras la compra: ${access.status} ${JSON.stringify(access.data).slice(0, 80)}`)

  const mine = await axios.get(`${SITE}/api/courses/premium/mine?walletAddress=${encodeURIComponent(addr)}`, { httpsAgent, headers: { Cookie: cookies }, validateStatus: (s) => s < 500 })
  const mineRows = mine.data?.courses || []
  const row = mineRows.find((c) => Number(c.course_id) === COURSE_ID)
  if (row) {
    // `slearn_amount_paid` se guarda en centésimas (100 = 1.00 SLEARN).
    const slearnRow = Number(row.slearn_amount_paid || 0) / 100
    ok(`La compra aparece en "mine" (${row.usdt_amount_paid} USDT + ${slearnRow.toFixed(2)} SLEARN, hash ${String(row.transaction_hash).slice(0, 10)}…)`)
  } else {
    fail(`La compra no aparece en "mine" (${mineRows.length} filas)`)
  }

  return finish()
}

function finish() {
  console.log(`\n${passed} passed / ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL:', e?.shortMessage || e?.response?.data || e?.message || e)
  if (process.env.DEBUG) {
    console.error('details:', e?.details || e?.cause?.details)
    console.error('meta:', JSON.stringify(e?.metaMessages || []))
    console.error(e)
  }
  process.exit(1)
})
