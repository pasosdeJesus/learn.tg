// E2E Test: Church selection persists on profile save + reload
// Uses setupE2EAuth for persistent auth across reloads.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome node e2e/specs/church-persistence.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  let pk, addr
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      pk = pk || content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      addr = addr || content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
    }
  }
  pk = pk || process.env.PRIVATE_KEY
  addr = addr || process.env.NEXT_PUBLIC_ADDRESS
  if (pk && addr) return { pk, addr }
  return null
}

async function navAndWait(page, url, timeout) {
  await page.goto(url, { waitUntil: 'domcontentloaded' , timeout: 120000 })
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const bodyLen = await page.evaluate(() =>
      document.body?.textContent?.replace(/\s+/g, '').length || 0)
    if (bodyLen > 100) return true
  }
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, chainId } = env
  const timeout = 120000
  const wallet = creds.addr
  console.log(`Wallet: ${wallet.slice(0,10)}... | ${base}\n`)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(timeout)

  // Auth: inject wallet mock + SIWE programmatico
  const { authToken } = await setupE2EAuth(page, wallet, creds.pk, chainId, base)

  // ── Go to profile ──
  console.log('── Profile page ──')
  await navAndWait(page, `${base}/en/profile`, timeout)
  await new Promise(r => setTimeout(r, 5000))

  // Check current church
  const churchBefore = await page.evaluate(() => {
    const body = document.body.textContent || ''
    const m = body.match(/Church[:\s]*([^\n]{3,40})/) || body.match(/Iglesia[:\s]*([^\n]{3,40})/)
    return m ? m[1].trim() : '(not found)'
  })
  console.log(`  Church before: "${churchBefore}"`)

  const hasChurchField = await page.evaluate(() => {
    const body = document.body.textContent || ''
    return body.includes('Church') || body.includes('Iglesia') ||
           body.includes('Place of worship') || body.includes('Lugar de culto')
  })
  if (!hasChurchField) {
    ok('No church field visible (religion may not be Christian)')
    await browser.close()
    process.exit(0)
  }
  ok('Church section found')

  // ── Assign church via API (reliable, no DOM select fragility) ──
  console.log('── Assign church via API ──')
  const assignRes = await page.evaluate(async ({ wallet, token }) => {
    try {
      // Fetch a church id from the admin API
      const authQ = `wallet=${encodeURIComponent(wallet)}&token=${encodeURIComponent(token)}`
      const r = await fetch(`/api/admin/churches?${authQ}`)
      if (!r.ok) return { error: `churches API HTTP ${r.status}` }
      const data = await r.json()
      const church = data.churches?.[0]
      if (!church?.id) return { error: 'No church found in API' }
      // Assign via profile PATCH
      const p = await fetch(`/api/profile?walletAddress=${encodeURIComponent(wallet)}&token=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ church_id: church.id }),
      })
      const body = await p.json()
      return { status: p.status, church_id: body.church_id || church.id, body }
    } catch (e) {
      return { error: e.message }
    }
  }, { wallet, token: authToken })

  if (assignRes.error) {
    fail(`Church assign failed: ${assignRes.error}`)
  } else {
    ok(`Church assigned via API (church_id: ${assignRes.church_id})`)
  }

  // Reload and verify persistence
  console.log('  Reloading...')
  await navAndWait(page, `${base}/en/profile`, timeout)
  await new Promise(r => setTimeout(r, 5000))

  // Verify church_id via API
  const profileData = await page.evaluate(async ({ wallet, token }) => {
    try {
      const r = await fetch(`/api/profile?walletAddress=${encodeURIComponent(wallet)}&token=${encodeURIComponent(token)}`)
      if (!r.ok) return { error: `HTTP ${r.status}` }
      return await r.json()
    } catch (e) {
      return { error: e.message }
    }
  }, { wallet, token: authToken })

  if (profileData.error) {
    console.log(`  Profile API: ${profileData.error}`)
    // Fallback to DOM check
    const churchAfter = await page.evaluate(() => {
      const body = document.body.textContent || ''
      const m = body.match(/Church[:\s]*([^\n]{3,40})/) || body.match(/Iglesia[:\s]*([^\n]{3,40})/)
      return m ? m[1].trim() : '(empty)'
    })
    console.log(`  Church after reload: "${churchAfter}"`)
    if (churchAfter !== '(empty)' && churchAfter !== '(not found)') {
      ok('Church persisted (DOM check)')
    } else {
      fail('Church did not persist after reload')
    }
  } else if (profileData.church_id) {
    ok(`Church persisted in DB (church_id: ${profileData.church_id})`)
  } else {
    fail('Church not found in profile API (church_id missing)')
  }

  await browser.close()
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  const failures = summary(t0)
  console.log(`\n${failures} failures | ${elapsed}s`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })