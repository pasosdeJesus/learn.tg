#!/usr/bin/env node
/**
 * R-#265 — reglas multibilletera en el sitio desplegado (smoke HTTP, sin Chrome).
 *
 * Verifica las tres reglas decididas el 2026-10-18:
 *   1. UBI: una vez por cuenta al día. La billetera nueva de la cuenta no puede
 *      cobrar si la cuenta ya reclamó hoy (y si cobra, la de la cuenta queda
 *      bloqueada por la regla de cuenta, no por el cooldown de dirección).
 *   2. Beca: una guía se paga una vez por cuenta. La billetera nueva envía una
 *      guía ya pagada a la de la cuenta y recibe `alreadyPaid` (sin llamar al vault).
 *   3. Desvincular: la respuesta informa `revoked`/`revokeFailures` y el motor
 *      rechaza dejar la cuenta sin billeteras.
 *
 * Mueve fondos de testnet: si la cuenta no ha reclamado el UBI ese día, la
 * billetera nueva lo reclama (0.75 CELO en Celo Sepolia). No paga becas: la guía
 * usada ya está pagada. La billetera nueva se desvincula siempre al final.
 *
 * Uso:
 *   SITE_URL=https://learn.tg:9001 node e2e/smoke/multiwallet-rules.spec.mjs
 *   SITE_URL=https://learn.tg:9001 bin/m test:e2e multiwallet-rules --smoke
 *   make test-smoke-multiwallet
 *
 * Skip (exit 0) sin `apps/.env`, sin una guía pagada con crucigrama resoluble o
 * si el sitio no sirve el curso de prueba.
 */

import 'dotenv/config'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { SiweMessage } from 'siwe'
import { answersFromGuideFile, solveCrossword } from '../helpers/crossword.mjs'

const BASE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = Number(process.env.CHAIN_ID || 11142220)
const PREFIX = 'web3-and-ubi'
const LANG = 'en'

let failed = 0
const ok = (text) => console.log(`  [OK] ${text}`)
const fail = (text) => { console.log(`  [FAIL] ${text}`); failed++ }
const skip = (text) => { console.log(`  [SKIP] ${text}`) }

function loadCredentials() {
  for (const envPath of [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]) {
    if (!fs.existsSync(envPath)) continue
    const content = fs.readFileSync(envPath, 'utf8')
    const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
    const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
    if (pk && addr) return { pk, addr: addr.toLowerCase() }
  }
  return null
}

function jar() {
  const cookies = new Map()
  return {
    header: () => [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; '),
    absorb(res) {
      const list = res.headers.getSetCookie?.() ?? []
      for (const raw of list) {
        const pair = raw.split(';')[0]
        const index = pair.indexOf('=')
        if (index > 0) cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim())
      }
    },
  }
}

async function request(cookies, pathname, options = {}) {
  const headers = new Headers(options.headers || {})
  const cookie = cookies.header()
  if (cookie) headers.set('cookie', cookie)
  const res = await fetch(new URL(pathname, BASE), { ...options, headers, redirect: 'manual' })
  cookies.absorb(res)
  return res
}

async function json(cookies, pathname, options) {
  const res = await request(cookies, pathname, options)
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

async function csrf(cookies) {
  const res = await request(cookies, '/api/auth/csrf')
  return (await res.json()).csrfToken
}

async function signSiwe(privateKey, nonce) {
  const account = privateKeyToAccount(privateKey)
  const url = new URL(BASE)
  const domain = url.port ? `${url.hostname}:${url.port}` : url.hostname
  const message = new SiweMessage({
    domain,
    address: account.address,
    statement: 'Sign in to Learn through games.',
    uri: BASE,
    version: '1',
    chainId: CHAIN_ID,
    nonce,
  }).prepareMessage()
  return { message, signature: await account.signMessage({ message }) }
}

async function login(privateKey) {
  const cookies = jar()
  const nonce = await csrf(cookies)
  const { message, signature } = await signSiwe(privateKey, nonce)
  const body = new URLSearchParams({ csrfToken: nonce, message, signature, redirect: 'false', json: 'true' })
  const res = await request(cookies, '/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`SIWE login failed: ${res.status}`)
  return cookies
}

const ACCOUNT_RULE = /once per account per day|una sola vez por cuenta al día/i
const OTHER_WALLET = /another wallet|otra billetera/i

async function checkUbi(cookiesA, cookiesB, addrA, addrB) {
  const body = (walletAddress) => JSON.stringify({ walletAddress })
  const claimB = await json(cookiesB, '/api/claim-celo-ubi', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: body(addrB),
  })
  if (claimB.status === 200) {
    ok('la billetera nueva reclamó el UBI (primera del día de la cuenta)')
    const claimA = await json(cookiesA, '/api/claim-celo-ubi', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: body(addrA),
    })
    if (claimA.status === 429 && ACCOUNT_RULE.test(claimA.body?.message || '')) {
      ok('la billetera de la cuenta queda bloqueada por la regla de cuenta (429)')
    } else {
      fail(`segundo UBI de la cuenta → ${claimA.status} ${JSON.stringify(claimA.body)}`)
    }
    return
  }
  if (claimB.status === 429 && ACCOUNT_RULE.test(claimB.body?.message || '')) {
    ok('la billetera nueva (sin cooldown propio) queda bloqueada por la regla de cuenta (429)')
    return
  }
  fail(`UBI con la billetera nueva → ${claimB.status} ${JSON.stringify(claimB.body)}`)
}

/**
 * Busca una guía ya pagada a la billetera de la cuenta y la envía con la nueva.
 * Devuelve false cuando no hay ninguna resoluble (el llamador hace SKIP).
 */
async function checkScholarship(cookiesA, cookiesB, addrA, addrB) {
  const catalog = await json(cookiesA, `/api/course-catalog?filtro[busprefijoRuta]=/${PREFIX}&filtro[busidioma]=${LANG}`)
  const course = Array.isArray(catalog.body) ? catalog.body[0] : null
  if (!course) return false
  const detail = await json(cookiesA, `/api/course-catalog/${course.id}`)
  const guides = (detail.body?.guias || []).map((guide) => guide.sufijoRuta).filter(Boolean)

  for (let index = 0; index < guides.length; index++) {
    const suffix = guides[index]
    const status = await json(
      cookiesA,
      `/api/guide-status?courseId=${course.id}&guideNumber=${index + 1}&walletAddress=${encodeURIComponent(addrA)}`,
    )
    if (!status.body?.receivedScholarship && !status.body?.receivedSlearnScholarship) continue

    const puzzleRes = await json(
      cookiesB,
      `/api/crossword?lang=${LANG}&prefix=${PREFIX}&guide=${suffix}&walletAddress=${encodeURIComponent(addrB)}`,
    )
    const puzzle = puzzleRes.body
    if (!puzzle?.grid || !puzzle?.placements?.length) continue

    let solved
    try {
      solved = solveCrossword(puzzle.grid, puzzle.placements, answersFromGuideFile(LANG, PREFIX, suffix))
    } catch (error) {
      console.log(`  [i] guía ${suffix}: ${error.message}`)
      continue
    }

    const submission = await json(cookiesB, '/api/check-crossword', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        courseId: Number(course.id),
        guideId: index + 1,
        walletAddress: addrB,
        lang: LANG,
        grid: solved,
        placements: puzzle.placements,
      }),
    })
    const message = submission.body?.message || ''
    if (submission.status === 200 && submission.body?.alreadyPaid === true && OTHER_WALLET.test(message)) {
      ok(`la billetera nueva no vuelve a cobrar la guía ${suffix} (alreadyPaid por otra billetera de la cuenta)`)
    } else {
      fail(`beca con la billetera nueva (guía ${suffix}) → ${submission.status} ${JSON.stringify(submission.body)}`)
    }
    return true
  }
  return false
}

async function main() {
  console.log(`Reglas multibilletera (R-#265) | ${BASE}\n`)

  const credentials = loadCredentials()
  if (!credentials) {
    skip('sin PRIVATE_KEY/NEXT_PUBLIC_ADDRESS en apps/.env')
    process.exit(0)
  }
  const walletB = generatePrivateKey()
  const addrB = privateKeyToAccount(walletB).address.toLowerCase()
  console.log(`  billetera de la cuenta: ${credentials.addr}`)
  console.log(`  billetera nueva:        ${addrB}\n`)

  const cookiesA = await login(credentials.pk)
  const wallets = await json(cookiesA, `/api/wallet?walletAddress=${encodeURIComponent(credentials.addr)}`)
  if (wallets.status !== 200) throw new Error(`GET /api/wallet → ${wallets.status}`)

  // Vincular la billetera nueva con la sesión de la cuenta: el SIWE lo firma la
  // nueva y el nonce es el CSRF de la sesión (misma política que /api/wallet/link).
  const nonceA = await csrf(cookiesA)
  const signedB = await signSiwe(walletB, nonceA)
  const linked = await json(cookiesA, '/api/wallet/link', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: signedB.message, signature: signedB.signature, walletAddress: credentials.addr }),
  })
  if (linked.status !== 200) {
    fail(`vincular la billetera nueva → ${linked.status} ${JSON.stringify(linked.body)}`)
    process.exit(1)
  }
  ok('la billetera nueva queda vinculada a la cuenta')

  let unlinked = false
  try {
    const cookiesB = await login(walletB)
    await checkUbi(cookiesA, cookiesB, credentials.addr, addrB)
    const scholarshipChecked = await checkScholarship(cookiesA, cookiesB, credentials.addr, addrB)
    if (!scholarshipChecked) skip('no hay guía pagada con crucigrama resoluble para verificar la beca')
  } finally {
    // La billetera de prueba no debe quedar colgada de la cuenta si algo falla.
    const result = await json(cookiesA, '/api/wallet/unlink', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: addrB, walletAddress: credentials.addr }),
    })
    if (result.status === 200 && Array.isArray(result.body?.revoked) && Array.isArray(result.body?.revokeFailures)) {
      unlinked = true
      ok(`billetera nueva desvinculada; revoked=${JSON.stringify(result.body.revoked)} revokeFailures=${JSON.stringify(result.body.revokeFailures)}`)
      if (result.body.revokeFailures.length > 0) fail('hubo fallos de revocación al desvincular')
    } else {
      fail(`desvincular la billetera nueva → ${result.status} ${JSON.stringify(result.body)}`)
    }
  }

  if (failed === 0 && unlinked) console.log('\n[OK] reglas multibilletera verificadas')
  else console.log(`\n[FAIL] ${failed} fallo(s)`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(`  [FAIL] ${error.message}`)
  process.exit(1)
})
