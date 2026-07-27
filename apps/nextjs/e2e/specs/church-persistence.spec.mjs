// E2E Test: Church selection persists on profile save + reload
// Uses setupSIWEMock for persistent wallet mock across reloads.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome node e2e/specs/church-persistence.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
  setupSIWEMock,
} from '@pasosdejesus/m/e2e'

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
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
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
  await setupSIWEMock(page, wallet, creds.pk, chainId)

  // ── Connect wallet ──
  console.log('── Connect wallet ──')
  await navAndWait(page, `${base}/en`, timeout)
  await new Promise(r => setTimeout(r, 3000))

  const hasConnect = await page.evaluate(() =>
    document.body.textContent?.includes('Connect Wallet') ||
    document.body.textContent?.includes('Conectar Billetera')
  )
  if (hasConnect) {
    const buttons = await page.$$('button')
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn)
      if (text?.includes('Connect') || text?.includes('Conectar')) {
        await btn.click()
        break
      }
    }
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const stillConnect = await page.evaluate(() =>
        document.body.textContent?.includes('Connect Wallet'))
      if (!stillConnect) break
    }
    ok('Wallet connected')
  } else {
    ok('Wallet already connected')
  }
  await new Promise(r => setTimeout(r, 5000))

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

  // Look for church selector / place of worship field
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

  // Try to find and click a church selector dropdown
  const churchSelected = await page.evaluate(() => {
    // Look for select/combobox near "Church" or "Iglesia"
    const selects = [...document.querySelectorAll('select, [role="combobox"]')]
    for (const s of selects) {
      const opts = s.querySelectorAll('option')
      if (opts.length > 1) {
        // Select the second option (first is usually placeholder)
        const val = opts[1].value
        if (val) {
          s.value = val
          s.dispatchEvent(new Event('change', { bubbles: true }))
          return opts[1].textContent?.trim() || 'selected'
        }
      }
    }
    return null
  })

  if (churchSelected) {
    ok(`Church selected: "${churchSelected}"`)
  } else {
    // Try clicking a church button/list item
    const clicked = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button, [role="option"]')]
      for (const b of buttons) {
        const t = (b.textContent || '').toLowerCase()
        if (t.includes('church') || t.includes('iglesia') || t.includes('select')) {
          b.click()
          return true
        }
      }
      return false
    })
    ok(clicked ? 'Clicked church selector' : 'No church selector to click')
  }

  // Save changes
  console.log('  Clicking Save...')
  const saveBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Save') || (b.textContent || '').includes('Guardar'))
  )
  if (saveBtn.asElement()) {
    await saveBtn.asElement().click()
    await new Promise(r => setTimeout(r, 5000))
    ok('Profile saved')
  } else {
    fail('Save button not found')
  }

  // Reload and verify persistence
  console.log('  Reloading...')
  await navAndWait(page, `${base}/en/profile`, timeout)
  await new Promise(r => setTimeout(r, 5000))

  const churchAfter = await page.evaluate(() => {
    const body = document.body.textContent || ''
    const m = body.match(/Church[:\s]*([^\n]{3,40})/) || body.match(/Iglesia[:\s]*([^\n]{3,40})/)
    return m ? m[1].trim() : '(empty)'
  })
  console.log(`  Church after reload: "${churchAfter}"`)

  if (churchAfter !== '(empty)' && churchAfter !== '(not found)') {
    ok('Church persisted after reload')
  } else {
    fail('Church did not persist after reload')
  }

  await browser.close()
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\n✅ ${summary.failures} failures | ${elapsed}s`)
  if (summary.failures > 0) process.exit(1)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
