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

  // Find a clickable user row (pending widget or recent users) that has a
  // place of worship; click the first one.
  const clicked = await page.evaluate(async () => {
    const rows = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'))
    for (const row of rows) {
      row.click()
      await new Promise(r => setTimeout(r, 1500))
      const text = document.body.textContent || ''
      if (text.includes('Assign Church') || text.includes('Asignar Iglesia')) {
        return { ok: true }
      }
    }
    return { ok: false, rowCount: rows.length }
  })
  console.log('Clicked:', JSON.stringify(clicked))
  if (!clicked.ok) fail('Could not open UserEditModal with Assign Church')

  await new Promise(r => setTimeout(r, 3000))

  const modalReport = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'))
    const info = selects.map((s, i) => {
      const opts = Array.from(s.options).map(o => o.textContent || '').slice(0, 5)
      return {
        i,
        value: s.value,
        disabled: s.disabled,
        optionCount: s.options.length,
        opts,
        parentLabel: (() => {
          let p = s.parentElement
          for (let k = 0; k < 3 && p; k++) { if (p.querySelector('label')) return p.querySelector('label')?.textContent; p = p.parentElement }
          return ''
        })(),
      }
    })
    // localStorage keys current state
    return {
      selects: info,
      addr: (localStorage.getItem('learn.tg.sessionAddress') || '').slice(0, 12),
      tokenLen: (localStorage.getItem('learn.tg.authToken') || '').length,
    }
  })
  console.log(JSON.stringify(modalReport, null, 2))

  const churchSelect = modalReport.selects.find(s => (s.parentLabel || '').toLowerCase().includes('church') && s.optionCount > 1)
  if (churchSelect) {
    ok(`ChurchSelector: value=${churchSelect.value} options=${churchSelect.optionCount} disabled=${churchSelect.disabled}`)
    if (churchSelect.disabled) fail('ChurchSelector is DISABLED (countryId null → form.pais_id empty)')
    if (churchSelect.optionCount <= 1) fail('ChurchSelector has NO options')
  } else {
    // fallback: report all selects
    fail('ChurchSelector not found among selects: ' + JSON.stringify(modalReport.selects.map(s => ({ i: s.i, value: s.value, n: s.optionCount, label: s.parentLabel }))))
  }

  await browser.close()
  console.log(`\n${summary.failures} failures`)
  if (summary.failures > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
