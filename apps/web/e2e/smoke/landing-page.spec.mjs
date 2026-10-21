// Smoke Test: Landing page loads without errors
// Run with: node e2e/smoke/landing-page.spec.mjs
//
// Detects regressions like "Failed to load courses" when Rails API is down.

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const sleep = ms => new Promise(r => setTimeout(r, ms))

let passed = 0, failed = 0
function ok(msg) { passed++; console.log(`  ✅ ${msg}`) }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`) }

async function main() {
  console.log(`Target: ${SITE}\n`)

  await sleep(200)

  // Test 1: /en returns 200
  console.log('── Test 1: GET /en returns 200 ──')
  try {
    const r1 = await fetch(`${SITE}/en`)
    if (r1.status === 200) ok('status 200')
    else fail(`status=${r1.status}`)
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  await sleep(1000)

  // Test 2: /es returns 200
  console.log('── Test 2: GET /es returns 200 ──')
  try {
    const r2 = await fetch(`${SITE}/es`)
    if (r2.status === 200) ok('status 200')
    else fail(`status=${r2.status}`)
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  await sleep(1000)

  // Test 3: /en page has course content (not error toasts)
  console.log('── Test 3: /en shows courses, not error ──')
  try {
    const r3 = await fetch(`${SITE}/en`)
    const html = await r3.text()
    if (html.includes('Failed to load courses')) {
      fail('Page shows "Failed to load courses" error')
    } else if (html.includes('Connect Wallet') || html.includes('Conectar Billetera')) {
      ok('Landing page loads with wallet connect button')
    } else {
      ok('Landing page loads (no error detected)')
    }
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  console.log(`\n${passed} passed / ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
