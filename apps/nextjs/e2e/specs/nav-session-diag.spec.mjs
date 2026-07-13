// Diagnostic E2E: Trace session/wagmi state across navigation
// Flow: / → /en → /en/a-relationship-with-Jesus
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome node e2e/specs/nav-session-diag.spec.mjs

import {
  initTestEnv, launchBrowser, newPage,
  simulateSIWE, safeNavigate,
} from '@pasosdejesus/m/e2e'

async function main() {
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, timeout, account, host, domainPort, chainId } = env
  console.log(`Wallet: ${account.address.slice(0,10)}... | ${base}\n`)
  const browser = await launchBrowser(env.headless)

  // Collect console logs from the page
  const logs = []
  function trace(page, label) {
    page.on('console', msg => {
      const t = msg.text()
      if (t.includes('PARTIAL LOGIN') || t.includes('Connect') || t.includes('session') ||
          t.includes('address') || t.includes('auth') || t.includes('useAuth')) {
        logs.push(`[${label}] ${t.slice(0, 150)}`)
      }
    })
  }

  async function checkState(page, label) {
    const state = await page.evaluate(() => {
      const body = document.body.textContent || ''
      const hasConnect = body.includes('Connect Wallet') || body.includes('Conectar Wallet') || body.includes('Conecta tu billetera')
      const hasPartial = body.includes('Partial login')
      const hasAddr = /0x[a-fA-F0-9]{6,}/.test(body)
      return { hasConnect, hasPartial, hasAddr, snippet: body.substring(0, 120).replace(/\s+/g, ' ') }
    })
    const cookies = await page.cookies()
    const sessionCookie = cookies.find(c => c.name.includes('next-auth.session-token'))
    console.log(`  [${label}] Connect btn: ${state.hasConnect} | Partial: ${state.hasPartial} | Addr visible: ${state.hasAddr} | Session cookie: ${!!sessionCookie}`)
    if (state.hasAddr) {
      const addr = await page.evaluate(() => {
        const m = document.body.textContent?.match(/(0x[a-fA-F0-9]{6})[a-fA-F0-9]*...[a-fA-F0-9]{4}/)
        if (!m) return null
        const all = document.body.textContent?.match(/(0x[a-fA-F0-9]{40,42})/)
        return all ? all[1].slice(0, 10) + '...' + all[1].slice(-4) : m[0]
      })
      if (addr) console.log(`    Address visible: ${addr}`)
    }
    return state
  }

  // ── Step 1: SIWE Auth ──
  console.log('── Step 1: SIWE Authentication ──')
  const page = await newPage(browser, account.address, timeout)
  trace(page, 'home')
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })

  const siweOk = await simulateSIWE(page, { account, host, domainPort, base, chainId })
  console.log(`  SIWE: ${siweOk ? '✅' : '❌'}`)
  if (!siweOk) { await browser.close(); process.exit(1) }

  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 3000))
  await checkState(page, '1-home')

  // ── Step 2: Navigate to /en ──
  console.log('\n── Step 2: Navigate to /en ──')
  const enLink = await page.$('a[href="/en"]')
  if (enLink) await safeNavigate(page, enLink, `${base}/en`)
  else await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 3000))
  await checkState(page, '2-en')

  // ── Step 3: Navigate to course ──
  console.log('\n── Step 3: Navigate to /en/a-relationship-with-Jesus ──')
  const courseLink = await page.$('a[href*="/a-relationship-with-Jesus"]') ||
    await page.$('a[href*="/una-relacion-con-Jesus"]')
  if (courseLink) {
    const href = await page.evaluate(el => el.getAttribute('href'), courseLink)
    await safeNavigate(page, courseLink, `${base}${href}`)
    await new Promise(r => setTimeout(r, 3000))
    await checkState(page, '3-course')

    // Check for course-specific elements
    const hasVault = await page.evaluate(() =>
      document.body.textContent?.includes('Vault') ||
      document.body.textContent?.includes('Bóveda') ||
      document.body.textContent?.includes('Boveda'))
    const hasProgress = await page.evaluate(() =>
      document.body.textContent?.includes('Progress') ||
      document.body.textContent?.includes('Progreso'))
    const hasDonate = await page.evaluate(() =>
      document.body.textContent?.includes('Donate') ||
      document.body.textContent?.includes('Donar'))
    console.log(`    Vault: ${hasVault} | Progress: ${hasProgress} | Donate: ${hasDonate}`)
  } else {
    console.log('  No course link found')
  }

  // ── Diagnostic logs ──
  if (logs.length > 0) {
    console.log('\n── Browser Console Logs ──')
    for (const log of logs) console.log(`  ${log}`)
  }

  await browser.close()
  console.log('\n✅ Done')
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
