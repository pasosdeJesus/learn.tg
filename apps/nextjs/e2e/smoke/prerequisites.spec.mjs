#!/usr/bin/env node

/**
 * Smoke test: Prerequisites for full-flow E2E tests.
 *
 * Verifies that the test wallet (from apps/.env) is ready for browser-based
 * E2E tests by checking and setting up:
 *
 *   1. Wallet is registered on the target server (SIWE sign-in works)
 *   2. Wallet has verifier role (NEXT_PUBLIC_VERIFIER_WALLET)
 *   3. Profile data can be set (PATCH /api/profile)
 *   4. Profile data can be self-verified (PATCH /api/admin/user/:id)
 *   5. Profile score reaches ≥ 50 (required for crossword + UBI claims)
 *
 * After this test passes, full-flow.spec.mjs can run successfully.
 *
 * Execution:
 *   bin/m test:e2e --smoke
 *   or: node e2e/smoke/prerequisites.spec.mjs
 *
 * Requirements:
 *   - apps/.env: PRIVATE_KEY, NEXT_PUBLIC_ADDRESS, NEXT_PUBLIC_VERIFIER_WALLET
 *   - Wallet must be whitelisted on the target server (see Developer Wallet
 *     Whitelist in apps/nextjs/README.md)
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import axios from 'axios'
import https from 'https'
import { SiweMessage } from 'siwe'
import { privateKeyToAccount } from 'viem/accounts'

// ── Config ──────────────────────────────────────────────────────────

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const httpsAgent = new https.Agent({ rejectUnauthorized: false })

let passed = 0
let failed = 0
function ok(msg) { passed++; console.log(`  [OK] ${msg}`) }
function fail(msg) { failed++; console.log(`  [FAIL] ${msg}`) }

// ── Load Env Credentials ────────────────────────────────────────────

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

// ── Cookie Helpers ──────────────────────────────────────────────────

function parseCookieHeader(header) {
  return header.split(';')[0].trim()
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
      const c = parseCookieHeader(h)
      const [name, ...rest] = c.split('=')
      if (name && rest.length) map.set(name, c)
    })
  }
  return Array.from(map.values()).join('; ')
}

// ── SIWE Sign-In ────────────────────────────────────────────────────

async function siweSignIn(privateKey, address) {
  const account = privateKeyToAccount(privateKey)

  // 1. Get CSRF token — ALSO capture cookie (NextAuth validates cookie against form data)
  const csrfRes = await axios.get(`${SITE}/api/auth/csrf`, { httpsAgent })
  const csrfToken = csrfRes.data.csrfToken
  if (!csrfToken) throw new Error('No CSRF token received')

  // Capture the CSRF cookie — required for callback validation
  let cookies = ''
  if (csrfRes.headers['set-cookie']) {
    cookies = updateCookies(cookies, csrfRes.headers['set-cookie'])
  }

  // 2. Build and sign SIWE message
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

  // 3. Authenticate — MUST include the CSRF cookie
  const formData = new URLSearchParams()
  formData.append('csrfToken', csrfToken)
  formData.append('message', message)
  formData.append('signature', signature)
  formData.append('redirect', 'false')
  formData.append('callbackUrl', `${SITE}/`)
  formData.append('json', 'true')

  const res = await axios.post(
    `${SITE}/api/auth/callback/credentials`,
    formData.toString(),
    {
      httpsAgent,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookies,
      },
      maxRedirects: 0,
      validateStatus: s => s < 400,
    }
  )
  // 302 redirect on success — capture session cookie
  if (res.headers['set-cookie']) {
    cookies = updateCookies(cookies, res.headers['set-cookie'])
  }

  return { token: csrfToken, cookies, address }
}

// ── API Helpers ─────────────────────────────────────────────────────

async function apiGet(path, params, cookies) {
  const url = new URL(path, SITE)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.get(url.toString(), {
    httpsAgent,
    headers: cookies ? { Cookie: cookies } : {},
  })
  return res.data
}

async function apiPatch(path, params, body, cookies) {
  const url = new URL(path, SITE)
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
  console.log(`Target: ${SITE}\n`)

  const creds = loadEnvCredentials()
  if (!creds) { console.error('[ERROR] No credentials found in apps/.env'); process.exit(1) }

  const { pk, addr } = creds
  console.log(`Wallet: ${addr.slice(0, 6)}...${addr.slice(-4)}`)

  // ════════════════════════════════════════════════════════════════
  // Test 1: Wallet is registered (SIWE sign-in works)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Test 1: Wallet registered (SIWE) ──')

  let authToken, cookies, userId
  try {
    const auth = await siweSignIn(pk, addr)
    authToken = auth.token
    cookies = auth.cookies
    ok(`SIWE sign-in OK — token: ${authToken.slice(0, 8)}...`)
  } catch (e) {
    fail(`SIWE sign-in failed: ${e.message}`)
    console.log(`\n${passed}/${passed + failed} passed — ${failed} failed\n`)
    process.exit(1)
  }

  // ════════════════════════════════════════════════════════════════
  // Test 2: Wallet is verifier
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Test 2: Wallet is verifier ──')

  try {
    const verifierCheck = await apiGet('/api/admin/check-verifier',
      { wallet: addr }, cookies)
    if (verifierCheck.isVerifier) {
      ok(`Verifier confirmed (${verifierCheck.count} configured)`)
    } else {
      fail(`NOT a verifier. Configured: ${verifierCheck.configuredWallets?.join(', ') || 'none'}`)
      console.log(`\n${passed}/${passed + failed} passed — ${failed} failed\n`)
      process.exit(1)
    }
  } catch (e) {
    fail(`Verifier check failed: ${e.message}`)
    console.log(`\n${passed}/${passed + failed} passed — ${failed} failed\n`)
    process.exit(1)
  }

  // ════════════════════════════════════════════════════════════════
  // Test 3: Can set profile data
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Test 3: Set profile data ──')

  try {
    // First get current profile to know userId and existing values
    const profile = await apiGet('/api/profile',
      { walletAddress: addr, token: authToken }, cookies)
    userId = profile.id
    ok(`Profile loaded — userId: ${userId}, score: ${profile.profilescore}`)

    // Set profile fields needed for verification
    const profileData = {
      nombre: profile.nombre || 'E2E Test User',
      email: 'e2e-test@learn.tg',
      whatsapp: '+1234567890',
      place_of_worship: 'E2E Test Church',
    }
    const patchRes = await apiPatch('/api/profile',
      { walletAddress: addr, token: authToken },
      profileData, cookies)
    ok(`Profile updated — new score: ${patchRes.profilescore}`)
  } catch (e) {
    fail(`Profile setup failed: ${e.message}`)
    if (e.response) console.log(`   Response: ${JSON.stringify(e.response.data)}`)
    console.log(`\n${passed}/${passed + failed} passed — ${failed} failed\n`)
    process.exit(1)
  }

  // ════════════════════════════════════════════════════════════════
  // Test 4: Can self-verify profile (admin PATCH)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Test 4: Self-verify profile (admin) ──')

  try {
    // Get current profile to read current values for verification
    const currentProfile = await apiGet('/api/profile',
      { walletAddress: addr, token: authToken }, cookies)

    // Set verified fields to match current profile values
    // passport_name == nombre → 26 pts
    // passport_nationality == pais_id → 24 pts
    // verified_email == email → 9 pts
    // verified_whatsapp == whatsapp → 9 pts
    // verified_place_of_worship == place_of_worship → 9 pts
    // Total: 26+24+9+9+9 = 77 pts (well above 50)
    const adminUpdates = {
      passport_name: currentProfile.nombre,
      passport_nationality: currentProfile.pais_id,
      verified_email: currentProfile.email,
      verified_whatsapp: currentProfile.whatsapp,
      verified_place_of_worship: currentProfile.place_of_worship,
    }

    const adminRes = await apiPatch(`/api/admin/user/${userId}`,
      { wallet: addr, token: authToken },
      adminUpdates, cookies)

    if (adminRes.success) {
      ok(`Admin verification OK — user: ${adminRes.user?.nombre}`)
    } else {
      fail(`Admin verification failed: ${JSON.stringify(adminRes)}`)
    }
  } catch (e) {
    fail(`Admin verification failed: ${e.message}`)
    if (e.response) console.log(`   Response: ${JSON.stringify(e.response.data)}`)
    console.log(`\n${passed}/${passed + failed} passed — ${failed} failed\n`)
    process.exit(1)
  }

  // ════════════════════════════════════════════════════════════════
  // Test 5: Profile score ≥ 50
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Test 5: Profile score ≥ 50 ──')

  try {
    // Re-fetch to get recalculated score
    const finalProfile = await apiGet('/api/profile',
      { walletAddress: addr, token: authToken }, cookies)

    if (finalProfile.profilescore >= 50) {
      ok(`Profile score: ${finalProfile.profilescore} (≥ 50 ✓) — ready for full-flow`)
    } else {
      fail(`Profile score: ${finalProfile.profilescore} (< 50) — full-flow will fail`)
    }
  } catch (e) {
    fail(`Final profile check failed: ${e.message}`)
  }

  // ════════════════════════════════════════════════════════════════
  console.log(`\n${passed}/${passed + failed} passed — ${failed} failed\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error('[ERROR]', err.message); process.exit(1) })
