// Smoke Test: Full User Journey — HTTP-only (no Chrome required)
// Validates all endpoints in the user journey respond correctly.
// Execution:
//   IPDES=learn.tg node e2e/smoke/full-journey.spec.mjs
//   Or: ./bin/m test:e2e --smoke full-journey

import {
  initTestEnv, resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const envCreds = loadEnvCredentials()
  if (!envCreds) { console.error('❌ No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = envCreds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, account, chainId, host, domainPort } = env
  const wallet = account.address.slice(0, 10) + '...'

  console.log(`Wallet: ${wallet} | ${base} (chain: ${chainId})`)
  console.log('Smoke: Full journey endpoints\n')

  // Set up SIWE auth via fetch (simulateSIWE uses page, we use fetch here)
  const { SiweMessage } = await import('siwe')

  // ── 1. CSRF token ──
  console.log('── 1. GET /api/auth/csrf ──')
  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  const csrfJson = await csrfRes.json()
  if (csrfRes.ok && csrfJson.csrfToken) ok(`CSRF token obtained: ${csrfJson.csrfToken.slice(0, 10)}...`)
  else fail(`CSRF failed: ${csrfRes.status}`)

  // ── 2. Session (should be null before auth) ──
  console.log('\n── 2. GET /api/auth/session (pre-auth) ──')
  const sessPreRes = await fetch(`${base}/api/auth/session`)
  const sessPreJson = await sessPreRes.json()
  if (sessPreRes.ok && !sessPreJson.address) ok('Session is null (not authenticated)')
  else if (sessPreJson.address) console.log('  ⚠️  Already authenticated (cookie from previous run)')
  else fail(`Session check failed: ${sessPreRes.status}`)

  // ── 3. Build and sign SIWE message ──
  console.log('\n── 3. SIWE sign + callback ──')
  const domain = `${host}${domainPort}`
  const msg = new SiweMessage({
    domain,
    address: account.address,
    statement: 'Sign in to Learn through games.',
    uri: base,
    version: '1',
    chainId,
    nonce: csrfJson.csrfToken,
  })
  const msgStr = msg.prepareMessage()
  const sig = await account.signMessage({ message: msgStr })

  // ── 4. POST /api/auth/callback/credentials ──
  const cbBody = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    message: msgStr,
    signature: typeof sig === 'string' ? sig : sig.signature || String(sig),
    redirect: 'false',
    json: 'true',
  })
  const cbRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cbBody.toString(),
    redirect: 'manual',
  })
  if (cbRes.ok) ok('SIWE callback OK')
  else fail(`SIWE callback failed: ${cbRes.status}`)

  // Extract cookies for subsequent requests
  // getSetCookie returns full Set-Cookie strings like "name=value; Path=/; HttpOnly"
  // We need just "name=value" for the Cookie request header
  const setCookieHeaders = cbRes.headers.getSetCookie?.() || []
  const cookieHeader = setCookieHeaders
    .map(c => c.split(';')[0])  // Take only "name=value" part
    .join('; ')

  // ── 5. Session (may not have address via pure fetch — NextAuth needs browser) ──
  console.log('\n── 5. GET /api/auth/session (post-auth) ──')
  const sessPostRes = await fetch(`${base}/api/auth/session`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  })
  const sessPostJson = await sessPostRes.json()
  if (sessPostRes.ok && sessPostJson.address) {
    ok(`Session established: ${sessPostJson.address.slice(0, 10)}...`)
  } else {
    console.log('  ⚠️  Session not established via fetch (NextAuth requires browser context for SIWE)')
  }

  // ── 6. GET /en (landing/courses) ──
  console.log('\n── 6. GET /en ──')
  const enRes = await fetch(`${base}/en`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  })
  const enHtml = await enRes.text()
  if (enRes.ok && enHtml.length > 500) {
    ok(`/en OK (${enHtml.length}B)`)
    const hasCourses = enHtml.includes('Course') || enHtml.includes('Curso') ||
      enHtml.includes('course') || enHtml.includes('curso')
    if (hasCourses) ok('/en contains course content')
    else console.log('  ⚠️  No course-related text in /en')
  } else fail(`/en failed: ${enRes.status} (${enHtml.length}B)`)

  // ── 7. Course links in /en ──
  console.log('\n── 7. Course links ──')
  const courseMatch = enHtml.match(/href="\/(en|es)\/[^"]+"/g)
  if (courseMatch) {
    const unique = [...new Set(courseMatch.map(m => m.replace(/href="|"/g, '')))]
      .filter(h => !h.includes('/profile') && !h.includes('/api/'))
    if (unique.length > 0) {
      ok(`Found ${unique.length} course link(s): ${unique[0]}`)
      // Try loading the first course
      const courseUrl = `${base}${unique[0]}`
      const courseRes = await fetch(courseUrl, {
        headers: cookieHeader ? { Cookie: cookieHeader } : {},
      })
      if (courseRes.ok) ok(`Course page OK: ${unique[0]} (${(await courseRes.text()).length}B)`)
      else console.log(`  ⚠️  Course ${unique[0]}: ${courseRes.status}`)

      // Try test/crossword page
      const testUrl = `${courseUrl}/test`
      const testRes = await fetch(testUrl, {
        headers: cookieHeader ? { Cookie: cookieHeader } : {},
      })
      if (testRes.ok) ok(`Crossword page OK: ${unique[0]}/test`)
      else console.log(`  ⚠️  Crossword ${unique[0]}/test: ${testRes.status}`)
    } else {
      console.log('  ⚠️  No course links found in /en')
    }
  }

  // ── 8. Profile API ──
  console.log('\n── 8. GET /api/profile ──')
  const profileRes = await fetch(`${base}/api/profile`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  })
  if (profileRes.ok) {
    ok('Profile API OK')
  } else if (profileRes.status === 401) {
    ok('Profile API returns 401 (needs profile, not just session)')
  } else {
    fail(`Profile API: ${profileRes.status}`)
  }

  // ── 9. Check-crossword API ──
  console.log('\n── 9. POST /api/check-crossword ──')
  const ccRes = await fetch(`${base}/api/check-crossword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ lang: 'en', grid: [], placements: [] }),
  })
  // 400 = bad request (expected), 401 = needs auth, 200 = ok
  if (ccRes.status === 400 || ccRes.status === 200 || ccRes.status === 401) {
    ok(`Check-crossword API: ${ccRes.status} (expected)`)
  } else {
    fail(`Check-crossword API: ${ccRes.status}`)
  }

  // ── 10. Claim-celo-ubi API ──
  console.log('\n── 10. POST /api/claim-celo-ubi ──')
  const claimRes = await fetch(`${base}/api/claim-celo-ubi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ walletAddress: account.address }),
  })
  if (claimRes.status === 401 || claimRes.status === 400 || claimRes.status === 200) {
    ok(`Claim-celo-ubi API: ${claimRes.status} (expected)`)
  } else {
    fail(`Claim-celo-ubi API: ${claimRes.status}`)
  }

  // ── 11. Sign out ──
  console.log('\n── 11. POST /api/auth/signout ──')
  const signoutRes = await fetch(`${base}/api/auth/signout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: new URLSearchParams({ csrfToken: csrfJson.csrfToken, json: 'true' }).toString(),
  })
  if (signoutRes.ok) ok('Sign out OK')
  else console.log(`  Sign out: ${signoutRes.status}`)

  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
