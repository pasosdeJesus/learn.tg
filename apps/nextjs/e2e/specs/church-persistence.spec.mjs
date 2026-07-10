// E2E Test: Church selection persists on profile save + reload
// Selects a church, saves, reloads, verifies it's still selected.
//
// Uses PRIVATE_KEY + NEXT_PUBLIC_ADDRESS from apps/.env
// Defaults to https://learn.tg:9001 (override with IPDES/PUERTOPRU)
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome node e2e/specs/church-persistence.spec.mjs
//
// Non-headless mode (to debug):
//   CONCABEZA=1 CHROME_PATH=/usr/local/bin/chrome node e2e/specs/church-persistence.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
  simulateSIWE,
} from '@pasosdejesus/m/e2e'

function loadEnvCredentials() {
  // Try paths from various working directories
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),            // from apps/nextjs/
    path.join(process.cwd(), 'apps', '.env'),          // from project root
    path.join(process.cwd(), '.env'),                  // .env in cwd
  ]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr, source: envPath }
    }
  }
  // Fall back to env vars
  if (process.env.PRIVATE_KEY && process.env.NEXT_PUBLIC_ADDRESS) {
    return { pk: process.env.PRIVATE_KEY, addr: process.env.NEXT_PUBLIC_ADDRESS, source: 'env vars' }
  }
  return null
}

const envCreds = loadEnvCredentials()

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (!envCreds) {
    console.error('❌ PRIVATE_KEY and NEXT_PUBLIC_ADDRESS not found in apps/.env or environment')
    console.error('   This test requires a real wallet with church/profile data.')
    process.exit(1)
  }
  console.log(`🔑 Using wallet from ${envCreds.source}: ${envCreds.addr.slice(0, 10)}...`)

  // Override TEST_PRIVATE_KEY so initTestEnv uses our .env key
  process.env.TEST_PRIVATE_KEY = envCreds.pk

  // Default to learn.tg dev server on port 9001
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  // Dev server runs on Celo Sepolia (chainId 11142220)
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, timeout, account, host, domainPort, chainId } = env

  console.log(`Wallet: ${account.address.slice(0,10)}... | ${base}\n`)
  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, account.address, timeout)

  // ── SIWE ──
  console.log('── SIWE Authentication ──')
  await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout })
  const siweOk = await simulateSIWE(page, { account, host, domainPort, base, chainId })
  if (!siweOk) { fail('SIWE failed'); await browser.close(); process.exit(1) }
  ok('SIWE completed')

  // Diagnostic: log ALL network requests
  const requests = []
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = req.url()
    if (url.includes('/api/') || url.includes('/profile') || url.includes('/_next')) {
      requests.push(`${req.method()} ${url.replace(base, '')}`)
    }
    req.continue()
  })

  // Reload with session
  await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 3000))

  console.log(`  Network requests after reload:`)
  if (requests.length === 0) {
    console.log(`    (none captured)`)
  } else {
    for (const r of requests) console.log(`    ${r}`)
  }

  // Diagnostic: check cookies
  const cookies = await page.cookies()
  const sessionCookie = cookies.find(c => c.name.includes('next-auth.session-token'))
  console.log(`  Session cookie: ${sessionCookie ? '✅ ' + sessionCookie.name : '❌ not found'}`)

  // Wait for React to hydrate
  console.log('  Waiting for React state...')
  for (let i = 0; i < 10; i++) {
    const state = await page.evaluate(() => {
      const body = document.body.textContent || ''
      if (body.includes('Partial login')) return 'partial'
      if (body.includes('Loading session')) return 'loading-session'
      if (body.includes('Loading profile')) return 'loading-profile'
      if (body.includes('Edit Profile') || body.includes('Edición del Perfil')) return 'form'
      return body.substring(0, 80)
    })
    console.log(`    [${i + 1}/10] ${state}`)
    if (state === 'form' || state === 'partial') break
    await new Promise(r => setTimeout(r, 3000))
  }

  // Profile page requires wagmi to detect a wallet (useAccount).
  // Mock wallets are NOT detected by wagmi — this is a known limitation.
  // Tests below only work with a real wallet (CONCABEZA=1 / non-headless).
  const hasPartial = await page.evaluate(() =>
    document.body.textContent?.includes('Partial login'))
  if (hasPartial) {
    console.log('  ⚠️  Wagmi did not detect wallet — Profile page shows "Partial login".')
    console.log('  ⚠️  Church persistence tests require a REAL wallet (CONCABEZA=1).')
    console.log('  ⚠️  Skipping church selection tests.')
    await browser.close()
    summary(t0)
    process.exit(0)
  }

  // Debug: check what's rendered
  const bodySnippet = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body
    return main.textContent?.replace(/\s+/g, ' ').trim().substring(0, 500)
  })
  console.log(`  Body: "${bodySnippet}"`)
  const hasForm = await page.$('form')
  console.log(`  Form found: ${!!hasForm}`)
  const inputs = await page.$$('input')
  console.log(`  Input elements: ${inputs.length}`)
  for (const inp of inputs.slice(0, 5)) {
    const id = await page.evaluate(el => el.id, inp)
    console.log(`    input#${id || '(no id)'}`)
  }

  ok('Profile page loaded (wallet detected by wagmi)')

  // ── Check if church is already selected ──
  const churchBefore = await page.evaluate(() => {
    const trigger = document.querySelector('#placeOfWorshipName')
    const val = trigger?.querySelector('[data-slot="select-value"]')
    return val?.textContent?.trim() || null
  })
  console.log(`  Church before: "${churchBefore || '(empty)'}"`)

  // ── Select city Freetown ──
  console.log('  Typing Freetown in location...')
  const cityInput = await page.$('#citySearch')
  if (!cityInput) { fail('City input not found'); await browser.close(); process.exit(1) }

  await cityInput.click()
  await cityInput.type('Freetown', { delay: 100 })
  await new Promise(r => setTimeout(r, 3000))

  // Click first suggestion
  const suggestions = await page.$$('#citySearch + div ul li')
  if (suggestions.length > 0) {
    await suggestions[0].click()
    console.log('  Selected city suggestion')
    await new Promise(r => setTimeout(r, 3000))
  } else {
    console.log('  No city suggestions found')
  }

  // ── Verify location display below address input ──
  console.log('  Checking location display...')
  const locationDisplay = await page.evaluate(() => {
    // The location text is in a <p> after the city input, showing country/dept/muni/city
    const cityInput = document.querySelector('#citySearch')
    const parent = cityInput?.closest('.space-y-2')
    const textPs = parent?.querySelectorAll('p.text-xs.text-gray-500')
    for (const p of textPs || []) {
      const text = p.textContent?.trim()
      if (text && text.includes(' / ')) return text
    }
    return null
  })
  if (locationDisplay) {
    ok(`Location display: ${locationDisplay}`)
  } else {
    console.log('  No location display found (may need country selected)')
  }

  // ── Select a church ──
  console.log('  Opening church selector...')
  const churchTrigger = await page.$('#placeOfWorshipName')
  if (!churchTrigger) { fail('Church selector not found'); await browser.close(); process.exit(1) }

  await churchTrigger.click()
  await new Promise(r => setTimeout(r, 2000))

  // Click the first church option (or "+ New church")
  const churchOptions = await page.$$('[role="option"]')
  if (churchOptions.length > 0) {
    console.log(`  Found ${churchOptions.length} church options, selecting first`)
    await churchOptions[0].click()
    await new Promise(r => setTimeout(r, 1000))
    ok('Church selected')
  } else {
    console.log('  No church options found')
    fail('No church options in dropdown')
  }

  // ── Save ──
  console.log('  Clicking Save Changes...')
  const saveBtn = await page.$('button[type="submit"]')
  if (!saveBtn) { fail('Save button not found'); await browser.close(); process.exit(1) }
  await saveBtn.click()
  await new Promise(r => setTimeout(r, 5000))

  // Check for success toast
  const saved = await page.evaluate(() => {
    return document.body.textContent?.includes('Profile updated') ||
           document.body.textContent?.includes('Perfil actualizado')
  })
  if (saved) ok('Profile saved successfully')
  else fail('No save confirmation found')

  // ── Reload and verify ──
  console.log('  Reloading profile page...')
  await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout })

  // SIWE again (session may be lost on reload)
  const siwe2Ok = await simulateSIWE(page, { account, host, domainPort, base, chainId })
  if (!siwe2Ok) { fail('SIWE on reload failed'); await browser.close(); process.exit(1) }

  await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 3000))

  const churchAfter = await page.evaluate(() => {
    const trigger = document.querySelector('#placeOfWorshipName')
    const val = trigger?.querySelector('[data-slot="select-value"]')
    return val?.textContent?.trim() || null
  })
  console.log(`  Church after reload: "${churchAfter || '(empty)'}"`)
  if (churchAfter && churchAfter !== 'Select your church' && churchAfter !== 'Selecciona tu iglesia') {
    ok(`Church persisted: ${churchAfter}`)
  } else {
    fail('Church did not persist after reload')
  }

  // ── Verify location persisted after reload ──
  const locationAfterReload = await page.evaluate(() => {
    const cityInput = document.querySelector('#citySearch')
    const parent = cityInput?.closest('.space-y-2')
    const textPs = parent?.querySelectorAll('p.text-xs.text-gray-500')
    for (const p of textPs || []) {
      const text = p.textContent?.trim()
      if (text && text.includes(' / ')) return text
    }
    return null
  })
  if (locationAfterReload) {
    ok(`Location persisted after reload: ${locationAfterReload}`)
  } else {
    console.log('  No location display after reload')
  }

  // ── Verify church page accessible ──
  const churchId = await page.evaluate(() => {
    // The church selector value is the church ID
    const trigger = document.querySelector('#placeOfWorshipName')
    const valEl = trigger?.querySelector('[data-slot="select-value"]')
    // Church ID might be embedded in the page or we can fetch from profile API
    return null // Can't extract ID from UI; skip navigation test
  })
  console.log(`  Church page: church ID not extractable from selector UI (skip navigation test)`)

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
