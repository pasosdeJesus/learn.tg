// E2E Test (R-#280): the admin calendar's delete works through the app API.
//
// Creates a block with the verifier session (POST /api/admin/calendar/block),
// confirms it appears in the listing (GET /api/admin/calendar/events), deletes it
// (DELETE .../block?uid=) and confirms it is gone; a second DELETE over the same
// block must be idempotent (200, not 502 "Failed to delete event").
//
// This is the app-level counterpart of the CalDAV smoke test: it exercises the
// route, the verifier wallet and the idempotent delete, not just Radicale.
//
// Execution (dev site):
//   CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=admin-calendar-delete

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

  // A ~30 min block an hour ahead: recent enough for the "upcoming" listing.
  const now = Date.now()
  const start = new Date(now + 60 * 60 * 1000).toISOString()
  const end = new Date(now + 90 * 60 * 1000).toISOString()
  const summaryText = `E2E R-280 ${now}`

  const listUids = async () => {
    const res = await page.evaluate(async (url) => {
      const r = await fetch(url)
      return { status: r.status, body: await r.json().catch(() => ({})) }
    }, `${base}/api/admin/calendar/events?${q}`)
    return { status: res.status, uids: (res.body?.events || []).map(e => e.uid) }
  }

  // ── Test 1: create a block through the app (POST, verifier wallet) ──
  console.log('\n── Test 1: POST calendar block ──')
  const created = await page.evaluate(async ({ url, payload }) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }, { url: `${base}/api/admin/calendar/block?${q}`, payload: { summary: summaryText, start, end } })
  const uid = created.body?.uid
  if (created.status === 200 && uid) ok(`POST block → 200 (uid=${short(uid)})`)
  else { fail(`POST block → ${created.status} ${JSON.stringify(created.body).slice(0, 80)}`) }

  // ── Test 2: the block appears in the listing ──
  console.log('\n── Test 2: the block is listed ──')
  let listed = false
  if (uid) {
    for (let i = 0; i < 6 && !listed; i++) {
      const { uids } = await listUids()
      listed = uids.includes(uid)
      if (!listed) await new Promise(r => setTimeout(r, 3000))
    }
  }
  if (listed) ok('new block appears in the calendar events')
  else fail('new block not found in the calendar events')

  // ── Test 3: delete the block (DELETE, verifier wallet) ──
  console.log('\n── Test 3: DELETE calendar block ──')
  let del1 = { status: 0 }
  if (uid) {
    del1 = await page.evaluate(async (url) => {
      const r = await fetch(url, { method: 'DELETE' })
      return { status: r.status, body: await r.json().catch(() => ({})) }
    }, `${base}/api/admin/calendar/block?uid=${encodeURIComponent(uid)}&${q}`)
    if (del1.status === 200 && del1.body?.success !== false) ok(`DELETE block → 200`)
    else fail(`DELETE block → ${del1.status} ${JSON.stringify(del1.body).slice(0, 80)}`)
  }

  // ── Test 4: the block no longer appears (listing is slow: ~16 s, retry) ──
  console.log('\n── Test 4: the deleted block is gone ──')
  let gone = false
  if (uid) {
    for (let i = 0; i < 8 && !gone; i++) {
      const { uids } = await listUids()
      gone = !uids.includes(uid)
      if (!gone) await new Promise(r => setTimeout(r, 3000))
    }
  }
  if (gone) ok('deleted block no longer appears')
  else fail('deleted block still appears in the listing')

  // ── Test 5: a second DELETE is idempotent (no "Failed to delete event") ──
  console.log('\n── Test 5: second DELETE is idempotent ──')
  if (uid) {
    const del2 = await page.evaluate(async (url) => {
      const r = await fetch(url, { method: 'DELETE' })
      return { status: r.status }
    }, `${base}/api/admin/calendar/block?uid=${encodeURIComponent(uid)}&${q}`)
    if (del2.status === 200) ok('second DELETE → 200 (already deleted is not an error)')
    else fail(`second DELETE → ${del2.status} (expected 200, not 502)`)
  }

  await browser.close()
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  const failures = summary(t0)
  console.log(`\n${failures} failures | ${elapsed}s`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
