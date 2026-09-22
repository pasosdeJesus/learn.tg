// Smoke Test: Transparency dashboard (public trust surface)
// Run with: make test-smoke   (or) node e2e/smoke/transparency.spec.mjs
//
// The whitepaper (SLEARN-WHITEPAPER.md §4) makes the transparency dashboard the
// public proof of the reserve/backing rules, so its two halves are asserted here
// over HTTP: the page exists and `/api/transparency` answers the documented
// contract. The page itself is client-rendered, hence the API is the real check.
//
// `/api/transparency` degrades gracefully: when the on-chain reads fail it still
// answers 200 without `reserves` (the DB totals are the part that must never
// break). That case is reported as OK with a warning.

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const sleep = ms => new Promise(r => setTimeout(r, ms))

let passed = 0, failed = 0
function ok(msg) { passed++; console.log(`  ✅ ${msg}`) }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`) }

async function main() {
  console.log(`Target: ${SITE}\n`)

  await sleep(200)

  // Test 1: the public page exists in both languages
  console.log('── Test 1: /en/transparency and /es/transparency return 200 ──')
  for (const lang of ['en', 'es']) {
    try {
      const r = await fetch(`${SITE}/${lang}/transparency`)
      if (r.status === 200) ok(`/${lang}/transparency status 200`)
      else fail(`/${lang}/transparency status=${r.status}`)
    } catch (e) { fail(`/${lang}/transparency fetch failed: ${e.message}`) }
    await sleep(500)
  }

  // Test 2: the API answers the documented shape
  console.log('── Test 2: GET /api/transparency returns data + totals + rules ──')
  let body = null
  try {
    const r = await fetch(`${SITE}/api/transparency`)
    if (r.status !== 200) {
      fail(`status=${r.status}`)
    } else {
      body = await r.json()
      if (Array.isArray(body.data)) ok(`data is an array (${body.data.length} countries)`)
      else fail(`data is not an array: ${typeof body.data}`)
      if (body.totals && typeof body.totals === 'object') ok('totals present')
      else fail('totals missing')
      if (body.rules !== undefined) ok('rules present')
      else fail('rules missing')
    }
  } catch (e) { fail(`fetch failed: ${e.message}`) }

  await sleep(500)

  // Test 3: the reserve/backing figures (or the documented degradation)
  console.log('── Test 3: reserves + coverage ratio ──')
  if (!body) {
    fail('skipped: no API body')
  } else if (!body.reserves) {
    ok('no reserves (on-chain read failed) — the API still answered, as documented')
  } else {
    const r = body.reserves
    const numbers = [
      'slearnTotalSupply', 'learnTgReserveUSDT', 'stableSlReserveUSDT',
      'reserveMultisigUSDT', 'coverageRatio',
    ]
    const bad = numbers.filter((k) => typeof r[k] !== 'number' || Number.isNaN(r[k]) || r[k] < 0)
    if (bad.length === 0) ok(`reserves are non-negative numbers (supply ${r.slearnTotalSupply}, coverage ${r.coverageRatio}%)`)
    else fail(`bad reserve figures: ${bad.join(', ')}`)

    if (r.coverageTarget === 120) ok('coverageTarget is the documented 120%')
    else fail(`coverageTarget=${r.coverageTarget} (expected 120)`)

    // La cobertura se calcula contra el mínimo exigido por el whitepaper:
    // totalSLEARN / 22. Con suministro 0 la relación es 0 por definición.
    const minimum = r.slearnTotalSupply / 22
    const expected = minimum > 0
      ? Math.round(((r.learnTgReserveUSDT + r.stableSlReserveUSDT + r.reserveMultisigUSDT) / minimum) * 100)
      : 0
    if (expected === r.coverageRatio) ok('coverageRatio matches the whitepaper formula')
    else fail(`coverageRatio=${r.coverageRatio} but the formula gives ${expected}`)

    if (typeof r.slearnExplorerUrl === 'string' && r.slearnExplorerUrl.startsWith('https://')) {
      ok('slearnExplorerUrl points to an explorer')
    } else {
      fail(`slearnExplorerUrl is not an https URL: ${r.slearnExplorerUrl}`)
    }
  }

  // Test 4: premium payments are part of the public accounting
  // (https://github.com/pasosdeJesus/learn.tg/issues/128 §9). The block degrades
  // like `reserves`: absent means the deployed build does not aggregate it yet.
  console.log('── Test 4: premium course payments ──')
  if (!body) {
    fail('skipped: no API body')
  } else if (!body.premium) {
    ok('no premium aggregate (deployed build predates it) — deploy to verify')
  } else {
    const p = body.premium
    const numbers = ['totalPurchases', 'totalUSDT', 'totalSLEARN']
    const bad = numbers.filter((k) => typeof p[k] !== 'number' || Number.isNaN(p[k]) || p[k] < 0)
    if (bad.length === 0) ok(`totals are numbers (${p.totalPurchases} purchases, ${p.totalUSDT} USDT, ${p.totalSLEARN} SLEARN)`)
    else fail(`bad premium totals: ${bad.join(', ')}`)

    if (!Array.isArray(p.courses)) {
      fail('courses is not an array')
    } else {
      const sum = (key) => p.courses.reduce((acc, c) => acc + Number(c[key] || 0), 0)
      const purchases = p.courses.reduce((acc, c) => acc + Number(c.purchases || 0), 0)
      const rounds = (n) => Math.round(n * 100) / 100
      if (purchases === p.totalPurchases && rounds(sum('usdt')) === rounds(p.totalUSDT) && rounds(sum('slearn')) === rounds(p.totalSLEARN)) {
        ok('per-course rows add up to the totals')
      } else {
        fail(`per-course rows (${purchases}, ${rounds(sum('usdt'))}, ${rounds(sum('slearn'))}) do not add up to the totals (${p.totalPurchases}, ${p.totalUSDT}, ${p.totalSLEARN})`)
      }
      const badCourse = p.courses.find((c) => typeof c.courseId !== 'number' || typeof c.purchases !== 'number')
      if (badCourse) fail(`bad course row: ${JSON.stringify(badCourse)}`)
      else ok(`course rows are well formed (${p.courses.length})`)
    }
  }

  console.log(`\n${passed} passed / ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
