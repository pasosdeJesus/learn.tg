#!/usr/bin/env node
// E2E Test: verified worship city required for paid (GD) course purchase
//
// A fresh Sierra Leone pastor without verifier confirmation must NOT be
// eligible; after the verifier confirms the place-of-worship location
// (verified_place_of_worship_location), eligibility must flip to true.
//
// Execution:
//   node e2e/specs/verified-city-gate.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import axios from 'axios'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from 'viem/accounts'
import { resetFailures, fail, ok, summary, short } from '@pasosdejesus/m/e2e'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

function loadEnvCredentials() {
  for (const envPath of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]) {
    if (fs.existsSync(envPath)) {
      const c = fs.readFileSync(envPath, 'utf8')
      const pk = c.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || c.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = c.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

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
  let cookies = ''
  if (csrfRes.headers['set-cookie']) cookies = updateCookies(cookies, csrfRes.headers['set-cookie'])
  const siweMessage = new SiweMessage({
    domain: new URL(SITE).host, address,
    statement: 'Sign in to Learn through games with DIVVI tracking.',
    uri: SITE, version: '1', chainId: CHAIN_ID, nonce: csrfToken,
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
    httpsAgent, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    maxRedirects: 0, validateStatus: s => s < 400,
  })
  if (res.headers['set-cookie']) cookies = updateCookies(cookies, res.headers['set-cookie'])
  return { token: csrfToken, cookies, address }
}

async function apiGet(pathname, params, cookies) {
  const url = new URL(pathname, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.get(url.toString(), { httpsAgent, headers: cookies ? { Cookie: cookies } : {} })
  return res.data
}

async function apiPatch(pathname, body, params, cookies) {
  const url = new URL(pathname, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.patch(url.toString(), body, {
    httpsAgent, headers: { 'Content-Type': 'application/json', ...(cookies ? { Cookie: cookies } : {}) },
  })
  return res.data
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  const verifier = loadEnvCredentials()
  if (!verifier) { console.error('No verifier credentials'); process.exit(1) }

  const pk = generatePrivateKey()
  const addr = privateKeyToAddress(pk)
  const testEmail = `gate-${addr.slice(2, 10).toLowerCase()}@learn.tg`
  console.log(`Pastor: ${short(addr)} | ${SITE}`)

  const s = await siweSignIn(pk, addr)
  const auth = { walletAddress: addr, token: s.token }

  // Fill SL profile (Christian, SL, non-Zionist) — but NOT verified
  await apiPatch('/api/profile', {
    nombre: 'E2E Gate', email: testEmail, pais_id: 694, religion_id: 2,
    position_israel_gaza: 'no', place_of_worship: 'E2E Gate Church',
    place_of_worship_location: 'Freetown', church_relationship: 'pastor',
  }, auth)
  const prof = await apiGet('/api/profile', auth)
  const uid = prof.id
  console.log(`userId: ${uid}, verified_city_id: ${prof.verified_city_id}, verified_place_of_worship_location: ${prof.verified_place_of_worship_location}`)

  // 1. Without verification → must be ineligible with the verified-city reason
  const before = await apiGet('/api/courses/10/purchase-eligibility', auth)
  console.log('Eligibility (unverified):', JSON.stringify(before))
  if (before.eligible === false && before.reason === 'verified_city_required') {
    ok(`Unverified pastor NOT eligible (${before.reason})`)
  } else {
    fail(`Expected eligible:false + verified_city_required, got ${JSON.stringify(before)}`)
  }

  // 2. Verifier confirms the worship location → eligible
  const vAuth = await siweSignIn(verifier.pk, verifier.addr)
  await apiPatch(`/api/admin/user/${uid}`, {
    verified_place_of_worship_location: 'Freetown',
    verified_place_of_worship: 'E2E Gate Church',
    verified_church_relationship: 'pastor',
  }, { wallet: verifier.addr, token: vAuth.token }, vAuth.cookies)

  const after = await apiGet('/api/courses/10/purchase-eligibility', auth)
  console.log('Eligibility (verified):', JSON.stringify(after))
  if (after.eligible === true) {
    ok('Verified pastor IS eligible')
  } else {
    fail(`Expected eligible:true after verification, got ${JSON.stringify(after)}`)
  }

  const failures = summary(t0)
  console.log(`\n${failures} failures`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
