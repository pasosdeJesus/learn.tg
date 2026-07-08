// E2E Test: Church selection persists on profile save + reload
// Selects a church, saves, reloads, verifies it's still selected.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg:9001 node e2e/specs/church-persistence.spec.mjs

import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
  simulateSIWE, waitForText,
} from '@pasosdejesus/m/e2e'

async function main() {
  const t0 = performance.now()
  resetFailures()
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

  // Reload with session
  await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 3000))
  ok('Profile page loaded')

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

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
