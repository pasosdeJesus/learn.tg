// E2E Test: Profile data verification for DSDev wallet
// Authenticates via SIWE and reads profile fields:
// Display Name, Full Name, Email, Religion, Country
//
// Execution:
//   make test-e2e-profile-data
//   or: CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg node e2e/specs/profile-data.spec.mjs

import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
  simulateSIWE, checkSessionFull, checkPartialLogin,
  waitForText, short,
} from '@pasosdejesus/m/e2e'

async function main() {
  const t0 = performance.now()
  resetFailures()
  const env = await initTestEnv()
  const { base, timeout, account, chainId, host, domainPort } = env

  console.log(`Wallet: ${short(account.address)} | ${base}\n`)
  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, account.address, timeout)

  // ── Authenticate via SIWE (deferred to profile page) ────
  console.log('── SIWE Authentication ──')

  // ── Navigate to profile ──────────────────────────────────
  console.log('\n── Profile page ──')
  // Navigate to profile directly, then SIWE there so session is fresh
  await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout })

  // Do SIWE on the profile page
  const siwe2Ok = await simulateSIWE(page, { account, host, domainPort, base, chainId })
  if (!siwe2Ok) { fail('SIWE on profile page failed'); await browser.close(); process.exit(1) }
  ok('SIWE on profile page completed')

  // Reload profile page with fresh session
  await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout })

  // Wait for profile data to load
  console.log('  Waiting for profile data...')
  let loaded = false
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const hasData = await page.evaluate(() => {
      const el = document.getElementById('uname')
      return el && el.value && el.value !== 'null' && el.value.length > 0
    })
    if (hasData) { loaded = true; break }
  }
  if (loaded) ok('Profile data loaded')
  else fail('Profile data did not load after 30s')

  // Check no "Partial login" for authenticated user
  if (await checkPartialLogin(page))
    fail('Profile shows Partial login — should not for authenticated user')
  else
    ok('No Partial login on profile (authenticated)')

  // ── Read profile fields ──────────────────────────────────
  console.log('\n── Profile fields ──')

  const uname = await page.evaluate(() => {
    const el = document.getElementById('uname')
    return el ? el.value : null
  })
  console.log(`  Display Name: "${uname}"`)
  if (uname) ok(`Display Name: ${uname}`)
  else fail('Display Name is empty')

  const fullName = await page.evaluate(() => {
    const el = document.getElementById('name')
    return el ? el.value : null
  })
  console.log(`  Full Name: "${fullName}"`)
  if (fullName) ok(`Full Name: ${fullName}`)
  else fail('Full Name is empty')

  const email = await page.evaluate(() => {
    const el = document.getElementById('email')
    return el ? el.value : null
  })
  console.log(`  Email: "${email}"`)
  if (email) ok(`Email: ${email}`)
  else fail('Email is empty')

  const religion = await page.evaluate(() => {
    // Plain <select> after refactor — find by looking for select near "Religion" label
    const labels = [...document.querySelectorAll('label')]
    const relLabel = labels.find(l => (l.textContent || '').trim() === 'Religion')
    if (!relLabel) return null
    const select = relLabel.parentElement?.querySelector('select') || relLabel.nextElementSibling?.querySelector('select')
    if (!select) return null
    const opt = select.options[select.selectedIndex]
    return opt?.textContent?.trim() || null
  })
  console.log(`  Religion: "${religion}"`)
  if (religion && religion !== 'null') ok(`Religion: ${religion}`)
  else ok('Religion: none selected (empty profile)')
  
  const country = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')]
    const cLabel = labels.find(l => (l.textContent || '').trim().startsWith('Country'))
    if (!cLabel) return null
    const select = cLabel.parentElement?.querySelector('select') || cLabel.nextElementSibling?.querySelector('select')
    if (!select) return null
    const opt = select.options[select.selectedIndex]
    return opt?.textContent?.trim() || null
  })
  console.log(`  Country: "${country}"`)
  if (country && country !== 'null') ok(`Country: ${country}`)
  else ok('Country: none selected (empty profile)')

  const profileScore = await page.evaluate(() => {
    const text = document.body.textContent || ''
    const m = text.match(/Profile Score[:\s]*(\d+)/i)
    return m ? m[1] : null
  })
  if (profileScore) {
    console.log(`  Profile Score: ${profileScore}`)
    ok(`Profile Score: ${profileScore}`)
  } else {
    console.log('  Profile Score: not found in text')
  }

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
