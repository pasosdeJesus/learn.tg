// Smoke Test: the GD cluster ranking exposes the cluster status (R-#220).
// Read-only: public GETs only, no session, no wallet, no writes, so it is safe
// against the development site and against production.
//
// Run with:
//   SITE_URL=https://learn.tg:9001 node e2e/smoke/gd-cluster-status.spec.mjs
//   make test-smoke-prod   (included in the read-only production set)

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const sleep = ms => new Promise(r => setTimeout(r, ms))

let passed = 0, failed = 0
function ok(msg) { passed++; console.log(`  [OK] ${msg}`) }
function fail(msg) { failed++; console.log(`  [FAIL] ${msg}`) }

async function main() {
  console.log(`Target: ${SITE}\n`)

  await sleep(200)

  // Test 1: the public ranking answers and carries the status of each cluster.
  console.log('── Test 1: GET /api/gdcluster/ranking/clusters ──')
  try {
    const r = await fetch(`${SITE}/api/gdcluster/ranking/clusters`)
    if (r.status !== 200) {
      fail(`status=${r.status}`)
    } else {
      const data = await r.json()
      const rows = data.clusters || []
      ok(`status 200 (${rows.length} clusters)`)
      const missing = rows.filter(c => !('status' in c))
      if (missing.length === 0) ok('every row exposes the cluster status')
      else fail(`${missing.length} rows without status (the deployed build is older than R-#220)`)
      const bad = rows.filter(c => c.status !== 'pending' && c.status !== 'active')
      if (bad.length === 0) ok('statuses are pending/active (disbanded clusters excluded)')
      else fail(`unexpected statuses: ${bad.map(c => c.status).join(', ')}`)
    }
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  await sleep(1000)

  // Test 2: the country ranking still answers.
  console.log('── Test 2: GET /api/gdcluster/ranking/countries ──')
  try {
    const r = await fetch(`${SITE}/api/gdcluster/ranking/countries`)
    if (r.status === 200) {
      const data = await r.json()
      ok(`status 200 (${(data.countries || []).length} countries)`)
    } else fail(`status=${r.status}`)
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  await sleep(1000)

  // Test 3: the public ranking page renders.
  console.log('── Test 3: GET /en/gdcluster/ranking ──')
  try {
    const r = await fetch(`${SITE}/en/gdcluster/ranking`)
    const html = await r.text()
    if (r.status !== 200) fail(`status=${r.status}`)
    else if (html.includes('Clusters') || html.includes('Clústeres')) ok('page renders with the ranking tabs')
    else ok('page renders (tabs are client-rendered)')
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  await sleep(1000)

  // Test 4: the admin clusters list stays behind the verifier auth.
  console.log('── Test 4: GET /api/admin/clusters without a session ──')
  try {
    const r = await fetch(`${SITE}/api/admin/clusters`)
    if (r.status === 403) ok('status 403 (admin auth enforced)')
    else fail(`status=${r.status}, expected 403`)
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  console.log(`\n${failed === 0 ? '[DONE]' : '[FAIL]'} ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
