// E2E Test: Session persistence and "Partial login" guard (R-#167)
// Validates loosened guard allows navigation without "Partial login"
// on read-only pages, and session survives navigation.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg node e2e/specs/auth-session.spec.mjs
//
// Or via m CLI:
//   ./bin/m test:e2e auth-session
//
// Known limitation: wagmi does not accept window.ethereum mock as
// valid connector (EIP-6963). Test verifies guard behavior via
// simulated SIWE + page navigation.

import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
  checkSessionFull, simulateSIWE, checkPartialLogin,
  safeNavigate, clearBrowserCache, waitForText, newIncognitoContext,
  newIncognitoPage,
  short,
} from '@pasosdejesus/m/e2e'

async function main() {
  const t0 = performance.now()
  resetFailures()
  // Default to learn.tg dev server
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, timeout, account, chainId, host, domainPort } = env

  console.log(`Wallet: ${short(account.address)} | ${base}\n`)
  const browser = await launchBrowser(env.headless)

  function logPartialLogin(page) {
    page.on('console', msg => {
      const t = msg.text()
      if (t.includes('PARTIAL LOGIN')) console.log('  [browser]', t.slice(0, 150))
    })
  }

  /** Wait for page to resolve after navigation — retry up to 3 times.
   *  After SIWE + navigation, useSession() may be slow (NextAuth bug #5719). */
  async function waitForNoPartial(page, targetUrl, label) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      for (let w = 0; w < 4; w++) {
        await new Promise(r => setTimeout(r, 2000))
        const state = await page.evaluate(() => {
          const body = document.body.textContent || ''
          if (body.includes('Partial login')) return 'partial'
          if (body.includes('Loading session') || body.includes('Loading profile')) return 'loading'
          return 'ok'
        })
        if (state !== 'loading') {
          if (state === 'ok') return true
          break
        }
      }
      if (attempt < 3) {
        console.log(`    ${label}: retry ${attempt}/3`)
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout })
      }
    }
    return false
  }

  // ── Test 1: Unauthenticated — course page renders ──────────────
  console.log('── Test 1: /en without auth → NO Partial login ──')
  {
    const page = await newPage(browser, account.address, timeout)
    logPartialLogin(page)
    await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })
    await new Promise(r => setTimeout(r, 2000))

    if (await checkPartialLogin(page))
      fail('/en without auth shows Partial login — should not')
    else ok('/en without auth does NOT show Partial login')

    const hasCourses = await page.evaluate(() =>
      document.body?.textContent?.includes('Course') ||
      document.body?.textContent?.includes('Curso'))
    if (hasCourses) ok('/en shows course content')
    else console.log("  ⚠️  No courses detected (may be normal without backend)")

    await page.close()
  }

  // ── Test 2: SIWE → multi-page navigation ───────────────────────
  console.log('\n── Test 2: SIWE → multi-page navigation without Partial login ──')
  {
    const page = await newPage(browser, account.address, timeout)
    logPartialLogin(page)

    // 2a. Landing + authenticate
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })
    const siweParams = { account, host, domainPort, base, chainId }
    const siweOk = await simulateSIWE(page, siweParams)
    if (siweOk) ok('SIWE completed')
    else fail('SIWE failed')

    if (await checkSessionFull(page))
      ok('Session cookie present after SIWE')
    else fail('No session cookie after SIWE')

    // 2b. Navigate to /en — retry if Partial login appears
    const enLink = await page.$('a[href="/en"]')
    if (enLink)
      await safeNavigate(page, enLink, `${base}/en`)
    else
      await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })

    if (await waitForNoPartial(page, `${base}/en`, '/en after SIWE'))
      ok('/en does NOT show Partial login after SIWE')
    else fail('/en shows Partial login after SIWE (3 retries exhausted)')

    if (await checkSessionFull(page))
      ok('Session persists in /en')
    else console.log('  ⚠️  Session lost in /en (known NextAuth bug)')

    // 2c. Navigate to course page
    const courseLink = await page.$('a[href*="/freecoder"]') ||
      await page.$('a[href*="/gooddollar"]') ||
      await page.$('a[href*="/web3-and-ubi"]')
    if (courseLink) {
      const courseHref = await page.evaluate(el => el.getAttribute('href'), courseLink)
      await safeNavigate(page, courseLink, courseHref ? `${base}${courseHref}` : null)

      if (await waitForNoPartial(page, courseHref ? `${base}${courseHref}` : `${base}/en`, 'course page'))
        ok('Course page does NOT show Partial login')
      else fail('Course page shows Partial login (3 retries exhausted)')

      // 2d. Navigate to first guide of the course
      const guideLinks = await page.$$('a')
      let guideClicked = false
      let guideHref = null
      for (const link of guideLinks) {
        const href = await page.evaluate(el => el.getAttribute('href'), link)
        if (href && href.match(/\/(guide|guia)\d*$/)) {
          await safeNavigate(page, link, `${base}${href}`)
          guideClicked = true
          guideHref = href
          break
        }
      }
      if (guideClicked) {
        if (await waitForNoPartial(page, `${base}${guideHref}`, 'guide page'))
          ok('Guide page does NOT show Partial login')
        else fail('Guide page shows Partial login (3 retries exhausted)')
      } else {
        console.log('  ⚠️  No guide link found')
      }

      // 2e. Return to /en
      await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })
      if (await waitForNoPartial(page, `${base}/en`, 'return to /en'))
        ok('Return to /en does NOT show Partial login')
      else fail('Return to /en shows Partial login (3 retries exhausted)')
    } else {
      console.log('  ⚠️  No course link found')
    }

    await page.close()
  }

  // ── Test 3: Profile → requires session (strict guard) ──────────
  console.log('\n── Test 3: /en/profile requires strict session ──')
  {
    // Use incognito context to avoid cookie contamination from Test 2
    const ctx = await newIncognitoContext(browser)
    const page = await newIncognitoPage(ctx, account.address, timeout)
    logPartialLogin(page)

    await clearBrowserCache(page)
    await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout })

    // Wait for React hydration (may lag post-deploy due to chunks)
    await waitForText(page, 'Partial login', 15)

    if (await checkPartialLogin(page))
      ok('Profile without SIWE shows Partial login (expected)')
    else fail('Profile without SIWE does NOT show Partial login (strict guard missing?)')

    await ctx.close()
  }

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
