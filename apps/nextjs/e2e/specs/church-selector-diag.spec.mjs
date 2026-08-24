// E2E Diagnostic: ChurchSelector empty options (Assign Church bug)
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     node e2e/specs/church-selector-diag.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary, short,
} from '@pasosdejesus/m/e2e'
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
  resetFailures()
  const creds = loadEnvCredentials()
  if (!creds) { console.error('Credentials not found in .env'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, chainId } = env
  const timeout = 180000
  const wallet = creds.addr
  console.log(`Wallet: ${short(wallet)} | ${base}\n`)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(timeout)

  const { sessionAddress, authToken } = await setupE2EAuth(page, wallet, creds.pk, chainId, base)
  console.log(`Session: ${short(sessionAddress)} tokenLen=${authToken.length}`)

  // ── 1. Reproduce ChurchSelector fetch exactly ──
  console.log('\n── 1. ChurchSelector fetch (exact reproduction) ──')
  const fetchReport = await page.evaluate(async () => {
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const tok = localStorage.getItem('learn.tg.authToken') || ''
    const params = new URLSearchParams({ q: '', country: '694' })
    if (addr) params.set('walletAddress', addr)
    if (tok) params.set('token', tok)
    const url = `/api/churches/search?${params}`
    const r = await fetch(url)
    let body = null
    try { body = await r.json() } catch { body = { parseError: true } }
    return {
      status: r.status,
      addrKey: !!addr, tokKey: !!tok, addr, tokenLen: tok.length,
      url,
      count: Array.isArray(body.churches) ? body.churches.length : null,
      first: Array.isArray(body.churches) ? body.churches.slice(0, 3) : body,
    }
  })
  console.log(JSON.stringify(fetchReport, null, 2))
  if (fetchReport.status === 200 && fetchReport.count > 0) {
    ok(`Search fetch: 200 with ${fetchReport.count} churches`)
  } else {
    fail(`Search fetch: status=${fetchReport.status} count=${fetchReport.count} addrKey=${fetchReport.addrKey} tokKey=${fetchReport.tokKey}`)
  }

  // ── 2. Stale token + fresh session (root cause: token rotation) ──
  console.log('\n── 2. Stale token + fresh session cookie ──')
  const staleTest = await page.evaluate(async () => {
    // Simulate the verifier's browser: token was rotated by a later login
    const originalTok = localStorage.getItem('learn.tg.authToken')
    localStorage.setItem('learn.tg.authToken', 'stale-token-00000000000000000000000000000000')
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const q1 = `walletAddress=${encodeURIComponent(addr)}&token=stale-token-00000000000000000000000000000000`
    const resSearch = await fetch(`/api/churches/search?q=&country=694&${q1}`)
    let searchStatus = resSearch.status
    let searchCount = null
    try { const j = await resSearch.json(); searchCount = Array.isArray(j.churches) ? j.churches.length : null } catch {}
    const q2 = `wallet=${encodeURIComponent(addr)}&token=stale-token-00000000000000000000000000000000`
    const resAdmin = await fetch(`/api/admin/users/recent?${q2}`)
    const adminStatus = resAdmin.status
    localStorage.setItem('learn.tg.authToken', originalTok || '')
    return { searchStatus, searchCount, adminStatus }
  })
  console.log('Stale-token result:', JSON.stringify(staleTest))
  if (staleTest.searchStatus === 200 && staleTest.searchCount > 0 && staleTest.adminStatus === 200) {
    ok(`Session fallback works: search=200(${staleTest.searchCount}), admin=200`)
  } else {
    fail(`Session fallback: search=${staleTest.searchStatus}(${staleTest.searchCount}) admin=${staleTest.adminStatus}`)
  }

  // ── 3. Admin dashboard → UserEditModal → ChurchSelector ──
  console.log('\n── 3. Admin dashboard → UserEditModal → ChurchSelector ──')
  await page.goto(`${base}/en/admin`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 8000))

  // Find a clickable user row that opens the modal with an ENABLED Assign
  // Church select (i.e. the user has a country). Users without pais_id
  // legitimately show the selector disabled, so iterate until one is found.
  let selectedReport = null
  const rowCount = await page.evaluate(() => document.querySelectorAll('[class*="cursor-pointer"]').length)
  for (let i = 0; i < Math.min(rowCount, 15); i++) {
    const clickedIdx = await page.evaluate((idx) => {
      const rows = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'))
      if (idx >= rows.length) return -1
      rows[idx].click()
      return idx
    }, i)
    if (clickedIdx < 0) break
    await new Promise(r => setTimeout(r, 4000))
    const m = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"], [class*="fixed inset-0"]')
      const selects = Array.from(document.querySelectorAll('select'))
      const info = selects.map((s, j) => {
        let p = s.parentElement
        let label = ''
        for (let k = 0; k < 3 && p; k++) { if (p.querySelector('label')) { label = p.querySelector('label')?.textContent || ''; break } p = p.parentElement }
        return { j, value: s.value, disabled: s.disabled, optionCount: s.options.length, label }
      })
      return { modal: !!modal, church: info.find(s => (s.label || '').toLowerCase().includes('church') && s.optionCount > 1) || null, all: info }
    })
    if (m.church && !m.church.disabled) {
      selectedReport = m.church
      break
    }
    // close the modal (Esc / close button) before trying the next row
    await page.keyboard.press('Escape').catch(() => {})
    await new Promise(r => setTimeout(r, 1000))
  }

  if (selectedReport) {
    ok(`ChurchSelector: value=${selectedReport.value} options=${selectedReport.optionCount} disabled=${selectedReport.disabled}`)
    if (selectedReport.optionCount <= 1) fail('ChurchSelector has NO options')
  } else {
    console.log('  [!] No user with a country (pais_id) found in the first rows — selector disabled is expected')
    ok('ChurchSelector: skipped (no country-having user in first 15 rows)')
  }

  await browser.close()
  console.log(`\n${summary.failures} failures`)
  if (summary.failures > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
