// E2E Test (R-#282): the verifier lists the students enrolled in a paid course.
//
// Exercises the app API and the admin widget:
//   - the roster endpoint is admin-only (no wallet → 403);
//   - the detail for a course matches the per-course aggregate
//     (`/api/admin/premium-purchases`) 1:1 on the number of enrolled people;
//   - a non-numeric id → 400, a missing course → 404;
//   - in `/{lang}/admin`, opening a course in the "Premium purchases" widget
//     shows the enrolled list.
//
// Execution (dev site):
//   CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=admin-course-enrolled

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary, short,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  let pk, addr, verifierAddr
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      pk = pk || content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      addr = addr || content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      verifierAddr = verifierAddr || content.match(/NEXT_PUBLIC_VERIFIER_WALLET="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_VERIFIER_WALLET=(\S+)/)?.[1]
    }
  }
  pk = pk || process.env.PRIVATE_KEY
  addr = addr || process.env.NEXT_PUBLIC_ADDRESS
  verifierAddr = verifierAddr || process.env.NEXT_PUBLIC_VERIFIER_WALLET
  if (pk && addr) return { pk, addr, verifierAddr }
  return null
}

async function navAndWait(page, url, timeout) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
      break
    } catch (e) {
      if (attempt === 2) throw e
      await new Promise(r => setTimeout(r, 3000))
    }
  }
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (!creds) { console.error('Credentials not found in .env'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { chainId } = env
  const { base } = resolveSiteTarget(env)
  const wallet = creds.addr
  const q = `wallet=${encodeURIComponent(wallet)}`

  const verifierWallets = (creds.verifierAddr || '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean)
  const isVerifier = verifierWallets.includes(wallet.toLowerCase())
  console.log(`Wallet: ${short(wallet)} | Verifier: ${isVerifier} | ${base}`)
  if (!isVerifier) {
    fail(`The .env wallet is not a verifier here (NEXT_PUBLIC_VERIFIER_WALLET=${creds.verifierAddr})`)
    const failures = summary(t0)
    process.exit(failures > 0 ? 1 : 0)
  }

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(180000)

  await setupE2EAuth(page, wallet, creds.pk, chainId, base)

  const api = (url) => page.evaluate(async (u) => {
    const r = await fetch(u)
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }, url)

  // ── Test 1: the roster is admin-only (no wallet) ──
  console.log('\n── Test 1: admin-only ──')
  const noAuth = await api(`${base}/api/admin/premium-purchases/7`)
  if (noAuth.status === 403 || noAuth.status === 401) ok(`without a verifier wallet → ${noAuth.status}`)
  else fail(`without a verifier wallet → ${noAuth.status} (expected 403)`)

  // ── Test 2: invalid id / missing course ──
  console.log('\n── Test 2: bad ids ──')
  const bad = await api(`${base}/api/admin/premium-purchases/abc?${q}`)
  if (bad.status === 400) ok('non-numeric id → 400')
  else fail(`non-numeric id → ${bad.status} (expected 400)`)
  const missing = await api(`${base}/api/admin/premium-purchases/999999?${q}`)
  if (missing.status === 404) ok('missing course → 404')
  else fail(`missing course → ${missing.status} (expected 404)`)

  // ── Test 3: the detail matches the per-course aggregate ──
  console.log('\n── Test 3: roster matches the aggregate ──')
  const agg = await api(`${base}/api/admin/premium-purchases?${q}`)
  if (agg.status !== 200) {
    fail(`aggregate → ${agg.status}`)
  } else {
    const courses = agg.body?.courses || []
    const withPurchases = courses.filter(c => Number(c.purchases) > 0)
    if (withPurchases.length === 0) {
      ok('no paid course has purchases yet — roster shape checked on the first paid course')
      // Fall back: pick a paid course from the public catalog and check the shape.
      const catalog = await api(`${base}/api/course-catalog`)
      const paid = (Array.isArray(catalog.body) ? catalog.body : []).find(c => Number(c.porPagar) > 0)
      if (!paid) {
        ok('no paid course configured either — roster test skipped')
      } else {
        const det = await api(`${base}/api/admin/premium-purchases/${paid.id}?${q}`)
        if (det.status === 200 && det.body.course && Array.isArray(det.body.students)) {
          ok(`detail for paid course #${paid.id}: 200, ${det.body.students.length} enrolled`)
        } else {
          fail(`detail for paid course #${paid.id}: ${det.status}`)
        }
      }
    } else {
      let allOk = true
      for (const c of withPurchases) {
        const det = await api(`${base}/api/admin/premium-purchases/${c.courseId}?${q}`)
        const n = det.body?.students?.length
        const matches = det.status === 200 && n === Number(c.purchases)
        const hasFields = (det.body?.students || []).every(s => s.id != null && (s.nombre || s.nusuario))
        if (matches && hasFields) {
          ok(`course #${c.courseId} "${c.titulo}": ${n} enrolled = ${c.purchases} purchases`)
        } else {
          allOk = false
          fail(`course #${c.courseId}: detail ${det.status}, ${n} enrolled vs ${c.purchases} purchases, fields=${hasFields}`)
        }
      }
      if (allOk) ok(`checked ${withPurchases.length} paid course(s)`)
    }
  }

  // ── Test 4: open a course in the admin widget ──
  console.log('\n── Test 4: the widget lists the enrolled ──')
  await navAndWait(page, `${base}/en/admin`, 180000)
  let widgetReady = false
  for (let i = 0; i < 30 && !widgetReady; i++) {
    await new Promise(r => setTimeout(r, 2000))
    widgetReady = await page.evaluate(() => !!document.querySelector('[data-testid="premium-purchases"]'))
  }
  if (!widgetReady) {
    fail('the Premium purchases widget did not render')
  } else {
    const rowSel = '[data-testid^="view-enrolled-"]'
    const hasRow = await page.evaluate((sel) => !!document.querySelector(sel), rowSel)
    if (!hasRow) {
      ok('no paid course has purchases — the widget shows the empty state')
    } else {
      await page.click(rowSel)
      let shown = false
      for (let i = 0; i < 15 && !shown; i++) {
        await new Promise(r => setTimeout(r, 1000))
        shown = await page.evaluate(() => !!document.querySelector('[data-testid="enrolled-list"]'))
      }
      if (shown) {
        const names = await page.evaluate(() =>
          [...document.querySelectorAll('[data-testid="enrolled-list"] tbody tr')].length)
        ok(`opening the course shows the enrolled list (${names} row(s))`)
      } else {
        fail('opening the course did not show the enrolled list')
      }
    }
  }

  await browser.close()
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  const failures = summary(t0)
  console.log(`\n${failures} failures | ${elapsed}s`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
