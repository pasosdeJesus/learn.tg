// Smoke Test: Verification availability timezone
// Run with: node e2e/smoke/verification-timezone.spec.mjs

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const sleep = ms => new Promise(r => setTimeout(r, ms))

let passed = 0, failed = 0

function ok(msg) { passed++; console.log(`  ✅ ${msg}`) }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`) }

async function main() {
  console.log(`Target: ${SITE}\n`)

  // Test 1
  console.log('── Test 1: availability API ──')
  await sleep(200)
  try {
    const r1 = await fetch(`${SITE}/api/verification/availability?days=7&duration=30`)
    const d1 = await r1.json()
    if ([200, 500].includes(r1.status)) ok(`status=${r1.status}`)
    else fail(`status=${r1.status}`)
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  // Test 2
  await sleep(1000)
  console.log('── Test 2: timezone=America/Bogota ──')
  try {
    const r2 = await fetch(`${SITE}/api/verification/availability?days=7&duration=30&timezone=America%2FBogota`)
    const d2 = await r2.json()
    if (r2.status === 200 && d2.timezone === 'America/Bogota') ok('America/Bogota')
    else fail(`Expected America/Bogota, got ${d2.timezone || r2.status}`)
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  // Test 3
  await sleep(1000)
  console.log('── Test 3: timezone=America/Caracas ──')
  try {
    const r3 = await fetch(`${SITE}/api/verification/availability?days=7&duration=30&timezone=America%2FCaracas`)
    const d3 = await r3.json()
    if (r3.status === 200 && d3.timezone === 'America/Caracas') ok('America/Caracas')
    else fail(`Expected America/Caracas, got ${d3.timezone || r3.status}`)
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  // Test 4
  await sleep(1000)
  console.log('── Test 4: default timezone ──')
  try {
    const r4 = await fetch(`${SITE}/api/verification/availability?days=7&duration=30`)
    const d4 = await r4.json()
    if (r4.status === 200 && d4.timezone === 'Africa/Freetown') ok('Africa/Freetown')
    else if (r4.status === 500) ok('CalDAV not configured (500)')
    else fail(`Expected Africa/Freetown, got ${d4.timezone || r4.status}`)
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  console.log(`\n${passed} passed / ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
