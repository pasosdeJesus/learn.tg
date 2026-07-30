// E2E Test: Full User Flow (R-#179)
// Covers: Connect → Profile fill → Admin self-verify → Courses → Crossword → UBI Claim → Disconnect
//
// PREREQUISITE: The test wallet (from apps/.env) must be registered and be a verifier
// on the dev server (https://learn.tg:9001). No prior profile score needed — this
// spec fills and self-verifies the profile to reach ≥50.
// See doc/e2e-testing.md § Wallet Prerequisites.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 node e2e/specs/full-flow.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
  setupSIWEMock, short,
} from '@pasosdejesus/m/e2e'

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

/** Navigate to URL and wait for body content */
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

/** Ensure session is still alive after navigation.
 *  NextAuth useSession() can be slow to hydrate after page transitions.
 *  Waits for either: address from session API, or localStorage fallback. */
async function ensureSessionAlive(page, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const alive = await page.evaluate(async () => {
      const lsAddr = localStorage.getItem('learn.tg.sessionAddress')
      const lsToken = localStorage.getItem('learn.tg.authToken')
      if (lsAddr && lsToken) return true
      try {
        const r = await fetch('/api/auth/session')
        const s = await r.json()
        if (s.address) return true
      } catch {}
      return false
    })
    if (alive) return true
    await new Promise(r => setTimeout(r, 1500))
  }
  return false
}

/** Click an element matching selector, retrying until found or timeout */
async function clickWhenFound(page, selector, timeout = 10000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const el = await page.$(selector)
    if (el) { await el.click(); return true }
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const envCreds = loadEnvCredentials()
  if (!envCreds) { console.error('[ERROR] No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = envCreds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, chainId } = env
  const timeout = 120000
  const wallet = short(envCreds.addr)

  console.log(`Wallet: ${wallet} | ${base} (chain: ${chainId})`)
  console.log('Target: Full user flow — profile fill → admin verify → crossword → UBI\n')

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()

  // Full mock: SIWE + balances + transactions
  await setupSIWEMock(page, envCreds.addr, envCreds.pk, chainId)

  // ════════════════════════════════════════════════════════════════
  // Step 1: Landing — Connect Wallet visible
  // ════════════════════════════════════════════════════════════════
  console.log('── Step 1: Landing — Connect Wallet ──')
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })
  let hasConnect = false
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 3000))
    hasConnect = await page.evaluate(() =>
      document.body.textContent?.includes('Connect Wallet') ||
      document.body.textContent?.includes('Conectar Billetera'))
    if (hasConnect) break
    console.log(`  Waiting for Connect Wallet... (${i + 1}/15)`)
  }
  hasConnect ? ok('Connect Wallet visible') : fail('Connect Wallet NOT visible')

  // ════════════════════════════════════════════════════════════════
  // Step 2: Click Connect → SIWE → reload → address
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 2: Connect → SIWE ──')
  const connectBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Connect') || (b.textContent || '').includes('Conectar'))
  )
  if (!connectBtn.asElement()) { fail('Connect button not found'); await browser.close(); process.exit(1) }
  await connectBtn.asElement().click()
  ok('Clicked Connect')

  let connected = false
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const stillConnect = await page.evaluate(() =>
      document.body.textContent?.includes('Connect Wallet'))
    if (!stillConnect) {
      const addrFound = await page.evaluate(() => {
        const text = document.body.textContent || ''
        return /0x[a-fA-F0-9]{4,}...[a-fA-F0-9]{4}/.test(text)
      })
      ok(`SIWE complete${addrFound ? ' — address visible' : ''}`)
      connected = true
      break
    }
    if (i === 39) fail('SIWE did not complete after 120s')
  }
  if (!connected) { await browser.close(); process.exit(1) }

  await new Promise(r => setTimeout(r, 5000))

  // Verify token is stored
  const lsAfterSiwe = await page.evaluate(() => ({
    token: localStorage.getItem('learn.tg.authToken')?.slice(0, 10),
    addr: localStorage.getItem('learn.tg.sessionAddress')?.slice(0, 10),
  }))
  if (lsAfterSiwe.token && lsAfterSiwe.addr) {
    ok(`Token persisted: ${lsAfterSiwe.token}... / ${lsAfterSiwe.addr}...`)
  } else {
    fail(`Token missing after SIWE: token=${lsAfterSiwe.token || 'NONE'} addr=${lsAfterSiwe.addr || 'NONE'}`)
  }

  // ════════════════════════════════════════════════════════════════
  // Step 3: Profile — fill fields and save
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 3: Profile fill ──')
  await ensureSessionAlive(page)

  // Navigate to profile — may show "Partial login" if NextAuth session
  // hasn't hydrated yet (known issue on OpenBSD). Reload until form appears.
  let profileFormReady = false
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout })
    await new Promise(r => setTimeout(r, 5000))

    const isPartialLogin = await page.evaluate(() =>
      document.body.textContent?.includes('Partial login'))
    if (!isPartialLogin) {
      // Verify form fields are actually rendered
      const hasName = await page.evaluate(() => !!document.getElementById('name'))
      if (hasName) { profileFormReady = true; break }
    }
    console.log(`  Profile not ready (attempt ${attempt + 1}/5), reloading...`)
  }

  if (!profileFormReady) {
    fail('Profile form did not render after 5 attempts — NextAuth session not hydrated')
    await browser.close(); process.exit(1)
  }
  ok('Profile form ready')

  // Wait for profile API to populate fields
  for (let w = 0; w < 10; w++) {
    await new Promise(r => setTimeout(r, 2000))
    const hasName = await page.evaluate(() => {
      const el = document.getElementById('name')
      return el && el.value && el.value.length > 0
    })
    if (hasName) break
    if (w === 9) console.log('  [!] Profile name field still empty')
  }

  // Fill Full Name
  const testName = 'E2E Flow Test'
  await page.evaluate((name) => {
    const el = document.getElementById('name')
    if (el) { el.value = name; el.dispatchEvent(new Event('input', { bubbles: true })) }
  }, testName)
  ok(`Set name: "${testName}"`)

  // Fill Email
  const testEmail = 'e2e-flow@learn.tg'
  await page.evaluate((email) => {
    const el = document.getElementById('email')
    if (el) { el.value = email; el.dispatchEvent(new Event('input', { bubbles: true })) }
  }, testEmail)
  ok(`Set email: "${testEmail}"`)

  // Fill WhatsApp — field exists but may not be visible in all profiles
  const testWhatsapp = '+1234567890'
  const waFound = await page.evaluate((wa) => {
    const el = document.getElementById('whatsapp')
    if (el) { el.value = wa; el.dispatchEvent(new Event('input', { bubbles: true })); return true }
    return false
  }, testWhatsapp)
  waFound ? ok(`Set WhatsApp: "${testWhatsapp}"`) : console.log('  [!] No WhatsApp field (#whatsapp) — skipping')

  // Fill Place of Worship — no id attribute, find by label text
  const testChurch = 'E2E Test Church'
  const churchFound = await page.evaluate((church) => {
    // Look for the place_of_worship input near its label
    const labels = [...document.querySelectorAll('label')]
    for (const label of labels) {
      const text = (label.textContent || '').toLowerCase()
      if (text.includes('place of worship') || text.includes('lugar de culto') ||
          text.includes('name of your') || text.includes('nombre de tu')) {
        // Find the input in the same container
        const container = label.closest('div')?.parentElement
        if (container) {
          const input = container.querySelector('input[type="text"]')
          if (input) {
            input.value = church
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
            return true
          }
        }
      }
    }
    return false
  }, testChurch)
  churchFound ? ok(`Set place_of_worship: "${testChurch}"`) : console.log('  [!] No place_of_worship field — skipping')

  // Save profile
  const saveBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Save') || (b.textContent || '').includes('Guardar'))
  )
  if (saveBtn.asElement()) {
    await saveBtn.asElement().click()
    await new Promise(r => setTimeout(r, 4000))
    ok('Profile saved')
  } else {
    fail('Save button not found')
  }

  // ════════════════════════════════════════════════════════════════
  // Step 4: Admin self-verify via API
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 4: Admin self-verify ──')

  // Get userId and current profile from API (same browser context = same auth)
  const profileData = await page.evaluate(async () => {
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const token = localStorage.getItem('learn.tg.authToken') || ''
    const url = `/api/profile?walletAddress=${encodeURIComponent(addr)}&token=${encodeURIComponent(token)}`
    const r = await fetch(url)
    if (!r.ok) return null
    return r.json()
  })

  if (!profileData || !profileData.id) {
    fail('Could not fetch profile via API — session may be stale')
    await browser.close(); process.exit(1)
  }
  const userId = profileData.id
  ok(`User ID: ${userId}, current score: ${profileData.profilescore}`)

  // Read current values that were just saved
  const currentName = profileData.nombre || testName
  const currentEmail = profileData.email || testEmail
  const currentWhatsapp = profileData.whatsapp || testWhatsapp
  const currentChurch = profileData.place_of_worship || testChurch
  const currentPaisId = profileData.pais_id

  // Self-verify via admin PATCH API
  const adminResult = await page.evaluate(async (params) => {
    const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
    const token = localStorage.getItem('learn.tg.authToken') || ''
    const url = `/api/admin/user/${params.userId}?wallet=${encodeURIComponent(addr)}&token=${encodeURIComponent(token)}`
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params.updates),
    })
    return r.ok ? await r.json() : { error: r.status, body: await r.text() }
  }, {
    userId,
    updates: {
      passport_name: currentName,
      passport_nationality: currentPaisId,
      verified_email: currentEmail,
      verified_whatsapp: currentWhatsapp,
      verified_place_of_worship: currentChurch,
    },
  })

  if (adminResult.success) {
    ok(`Admin verify OK — user: ${adminResult.user?.nombre}, new score: ${adminResult.user?.profilescore}`)
  } else {
    fail(`Admin verify failed: ${JSON.stringify(adminResult).slice(0, 120)}`)
  }

  // ════════════════════════════════════════════════════════════════
  // Step 5: Profile score ≥ 50
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 5: Profile score ≥ 50 ──')
  await ensureSessionAlive(page)
  await navAndWait(page, `${base}/en/profile`, timeout)
  await new Promise(r => setTimeout(r, 4000))

  // Wait for profile score to appear
  for (let w = 0; w < 8; w++) {
    await new Promise(r => setTimeout(r, 2000))
    const hasScore = await page.evaluate(() =>
      document.body.textContent?.includes('Profile Score') ||
      document.body.textContent?.includes('Puntaje de Perfil'))
    if (hasScore) break
    if (w === 7) console.log('  [!] Profile score still loading...')
  }

  const scoreMatch = await page.evaluate(() => {
    const body = document.body.textContent || ''
    const idx = body.indexOf('Profile Score') !== -1 ? body.indexOf('Profile Score') :
                body.indexOf('Puntaje de Perfil')
    if (idx === -1) return null
    const nearby = body.slice(idx, idx + 80)
    const m = nearby.match(/(\d{1,3})/)
    return m ? parseInt(m[1]) : null
  })
  if (scoreMatch !== null) {
    if (scoreMatch >= 50) {
      ok(`Profile score: ${scoreMatch} (≥ 50 ✓)`)
    } else {
      fail(`Profile score: ${scoreMatch} (< 50 — UBI and crossword WILL fail)`)
    }
  } else {
    fail('Could not extract profile score')
  }

  // ════════════════════════════════════════════════════════════════
  // Step 6: /en — courses page
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 6: /en — courses ──')
  const enOk = await navAndWait(page, `${base}/en`, timeout)
  if (!enOk) { fail('/en did not render'); await browser.close(); process.exit(1) }
  ok('/en loaded')
  await new Promise(r => setTimeout(r, 2000))

  // Check for error toasts
  const hasErrorToast = await page.evaluate(() => {
    const toastEls = document.querySelectorAll('[role="status"], [data-slot="toast"], .toast')
    for (const el of toastEls) {
      const t = el.textContent || ''
      if (t.includes('Failed to load') || t.includes('falló') || t.includes('Error')) return t.slice(0, 80)
    }
    return null
  })
  if (hasErrorToast) fail(`Error toast on /en: "${hasErrorToast}"`)
  else ok('No error toasts on landing page')

  const courseLinks = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .filter(a => {
        const h = a.getAttribute('href') || ''
        return h.startsWith('/en/') || h.startsWith('/es/')
      })
      .map(a => ({
        href: a.getAttribute('href'),
        text: a.textContent?.trim().slice(0, 60) || '',
      }))
      .filter(l => l.href && !l.href.includes('/profile'))
  )
  if (courseLinks.length > 0) {
    ok(`Found ${courseLinks.length} course link(s)`)
  } else {
    fail('No course links found')
  }

  // ════════════════════════════════════════════════════════════════
  // Step 7: Enter course
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 7: Enter course ──')
  let courseEntered = false
  let courseHref = null
  const realCourse = courseLinks.find(l =>
    !l.href.includes('privacy') && !l.href.includes('terms'))
  if (realCourse) {
    courseHref = realCourse.href
    const courseOk = await navAndWait(page, `${base}${courseHref}`, timeout)
    if (courseOk) {
      ok(`Entered: ${courseHref}`)
      courseEntered = true
    } else fail(`Course ${courseHref} did not render`)
  } else {
    console.log('  [!] No real courses available')
    if (courseLinks.length > 0) {
      courseHref = courseLinks[0].href
      await navAndWait(page, `${base}${courseHref}`, timeout)
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Step 8: Donate — client-rendered, wait for button
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 8: Donate ──')
  if (courseEntered) {
    let donateFound = false
    for (let w = 0; w < 8; w++) {
      await new Promise(r => setTimeout(r, 2000))
      donateFound = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some(b =>
          (b.textContent || '').includes('Donate') || (b.textContent || '').includes('Donar')))
      if (donateFound) break
    }
    if (donateFound) {
      const donateBtn = await page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find(b =>
          (b.textContent || '').includes('Donate') || (b.textContent || '').includes('Donar')))
      await donateBtn.asElement().click()
      ok('Donate dialog opened')
      await new Promise(r => setTimeout(r, 2000))
      const cancelBtn = await page.evaluateHandle(() =>
        [...document.querySelectorAll('[role="dialog"] button')].find(b =>
          (b.textContent || '').includes('Cancel') || (b.textContent || '').includes('Cancelar'))
      )
      if (cancelBtn.asElement()) await cancelBtn.asElement().click()
      else await page.keyboard.press('Escape')
    } else {
      const btns = await page.evaluate(() =>
        [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(t => t).slice(0, 8))
      console.log(`  Course buttons: ${JSON.stringify(btns)}`)
      console.log('  [!] No Donate button after 16s')
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Step 9: Guide page
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 9: Guide ──')
  if (courseEntered && courseHref) {
    await ensureSessionAlive(page)
    await page.goto(`${base}${courseHref}`, { waitUntil: 'domcontentloaded', timeout })
    let guideLinks = []
    for (let w = 0; w < 12; w++) {
      await new Promise(r => setTimeout(r, 2000))
      guideLinks = await page.evaluate(() =>
        [...document.querySelectorAll('a[href]')]
          .map(a => a.getAttribute('href'))
          .filter(h => h && h.match(/\/(guide|guia)\d*$/)))
      if (guideLinks.length > 0) break
      if (w === 5 || w === 9) {
        const allLinks = await page.evaluate(() =>
          [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/')))
        console.log(`  Links at ${w * 2}s: ${JSON.stringify(allLinks.slice(0, 10))}`)
      }
    }
    if (guideLinks.length > 0) {
      const gOk = await navAndWait(page, `${base}${guideLinks[0]}`, timeout)
      gOk ? ok(`Guide: ${guideLinks[0]}`) : fail('Guide did not render')
    } else console.log('  [!] No guide links after 24s')
  }

  // ════════════════════════════════════════════════════════════════
  // Step 10: Crossword — fill cells and submit
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 10: Crossword ──')
  if (courseEntered && courseHref) {
    const testUrl = `${courseHref}/test`
    await ensureSessionAlive(page)
    const testOk = await navAndWait(page, `${base}${testUrl}`, timeout)
    if (testOk) {
      ok(`Crossword loaded: ${testUrl}`)

      // Crossword inputs are client-rendered (fetched from API after hydration)
      let gridInputs = []
      for (let w = 0; w < 10; w++) {
        await new Promise(r => setTimeout(r, 2000))
        gridInputs = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="text"]')
          return Array.from(inputs).map((inp, i) => ({
            idx: i,
            value: inp.value || '',
            disabled: inp.disabled,
            readOnly: inp.readOnly,
            className: inp.className?.slice(0, 30) || '',
          }))
        })
        const activeInputs = gridInputs.filter(i => !i.disabled && !i.readOnly)
        if (activeInputs.length > 0) break
        if (w === 5) {
          const bodyLen = await page.evaluate(() => document.body?.textContent?.length || 0)
          console.log(`  Page body: ${bodyLen} chars, inputs: ${gridInputs.length}`)
        }
      }

      const activeInputs = gridInputs.filter(i => !i.disabled && !i.readOnly)
      if (activeInputs.length > 0) {
        ok(`Crossword grid: ${activeInputs.length} fillable cells`)

        let filled = 0
        const inputs = await page.$$('input[type="text"]')
        for (const inp of inputs) {
          const isDisabled = await page.evaluate(el => el.disabled || el.readOnly, inp)
          if (!isDisabled && filled < 5) {
            await inp.click()
            await inp.type(String.fromCharCode(65 + filled))
            filled++
          }
        }
        if (filled > 0) ok(`Filled ${filled} crossword cells`)

        await new Promise(r => setTimeout(r, 1000))
        const submitBtn = await page.evaluateHandle(() =>
          [...document.querySelectorAll('button')].find(b =>
            (b.textContent || '').includes('Submit') || (b.textContent || '').includes('Enviar'))
        )
        if (submitBtn.asElement()) {
          const isDisabled = await page.evaluate(el => el.disabled, submitBtn.asElement())
          if (!isDisabled) {
            await submitBtn.asElement().click()
            await new Promise(r => setTimeout(r, 4000))
            const feedback = await page.evaluate(() => {
              const body = document.body.textContent || ''
              if (body.includes('Correct') || body.includes('Correcto') ||
                  body.includes('Wrong') || body.includes('Incorrecto') ||
                  body.includes('winner') || body.includes('ganador'))
                return body.slice(body.search(/Correct|Wrong|winner|ganador|Incorrecto/), 80)
              return null
            })
            if (feedback) ok(`Crossword feedback: "${feedback.slice(0, 50)}"`)
            else console.log('  [!] No visible feedback after submit')
          } else console.log('  [!] Submit disabled')
        } else console.log('  [!] No submit button')
      } else console.log('  [!] No fillable crossword cells after wait')
    } else console.log(`  [!] Crossword not at ${testUrl}`)
  }

  // ════════════════════════════════════════════════════════════════
  // Step 11: UBI Claim
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 11: UBI Claim ──')
  await ensureSessionAlive(page)
  const ubiPath = process.env.GUIDE_CLAIM_PATH || '/en/web3-and-ubi/guide3'

  // Navigate and wait for client-rendered buttons (CeloUbiButton, GoodDollarButton)
  // These are React components that only render after hydration + session check
  let ubiOk = await navAndWait(page, `${base}${ubiPath}`, timeout)
  if (!ubiOk) { fail('UBI guide not found'); }

  // The UBI buttons are client-rendered — may need page reload if session just restored
  let claimFound = false
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      console.log(`  Reloading UBI guide (attempt ${attempt + 1}/3)...`)
      await page.goto(`${base}${ubiPath}`, { waitUntil: 'domcontentloaded', timeout })
    }
    // Wait for client-side hydration
    for (let w = 0; w < 10; w++) {
      await new Promise(r => setTimeout(r, 2500))
      const hasBtn = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some(b =>
          (b.textContent || '').includes('Claim') || (b.textContent || '').includes('Reclamar')))
      const isLoading = await page.evaluate(() =>
        document.body.textContent?.includes('Loading...') || document.body.textContent?.includes('Cargando...'))
      if (hasBtn) { claimFound = true; break }
      if (!isLoading && w > 4) break // Page loaded but no button — try reload
    }
    if (claimFound) break
  }

  if (claimFound) {
    ok(`UBI guide loaded: ${ubiPath}`)

    const claimBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b =>
        (b.textContent || '').includes('Claim Learn.tg-UBI') ||
        (b.textContent || '').includes('Reclamar Learn.tg-IBU'))
    )
    if (claimBtn.asElement()) {
      ok('Claim button found')
      await claimBtn.asElement().click()
      ok('Clicked Claim')

      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const dialogText = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]')
          return d?.textContent?.trim() || ''
        })
        if (dialogText.includes('Claim Successful') || dialogText.includes('Reclamo Exitoso')) {
          ok('UBI claimed successfully ✅')
          break
        }
        if (dialogText.includes('cooldown') || dialogText.includes('enfriamiento') ||
            dialogText.includes('already claimed') || dialogText.includes('ya reclamado')) {
          ok('UBI: cooldown active (expected)')
          break
        }
        if (dialogText.includes('Error') || dialogText.includes('must be at least') ||
            dialogText.includes('score') || dialogText.includes('puntaje')) {
          fail(`UBI claim rejected: "${dialogText.slice(0, 80)}"`)
          break
        }
        if (i === 14) console.log('  [!] UBI dialog still pending')
      }
    } else {
      fail('Claim button not found')
    }
  } else {
    // Log what's on the page for debugging
    const pageButtons = await page.evaluate(() =>
      [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(t => t)
    )
    console.log(`  Page buttons: ${JSON.stringify(pageButtons)}`)
    fail('Claim button not found — UBI buttons are client-rendered, may need active session')
  }

  // ════════════════════════════════════════════════════════════════
  // Step 12: Disconnect ✕ → Connect Wallet returns
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 12: Disconnect ✕ ──')
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })
  await ensureSessionAlive(page)

  // The ✕ (disconnect) button is client-rendered by ConnectWalletButton.
  // May need reload if session just restored from localStorage.
  let dcFound = false
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })
    }
    await new Promise(r => setTimeout(r, 4000))
    dcFound = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some(b =>
        (b.textContent || '').trim() === '✕'))
    if (dcFound) break
    console.log(`  ✕ not visible (attempt ${attempt + 1}/3)`)
  }

  if (dcFound) {
    const disconnectBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b =>
        (b.textContent || '').trim() === '✕')
    )
    await disconnectBtn.asElement().click()
    ok('Clicked ✕')
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const reconnected = await page.evaluate(() =>
        document.body.textContent?.includes('Connect Wallet') ||
        document.body.textContent?.includes('Conectar Billetera'))
      if (reconnected) { ok('Connect Wallet returned'); break }
      if (i === 7) fail('Connect Wallet did NOT return')
    }
  } else {
    // Log page buttons for debugging
    const btns = await page.evaluate(() =>
      [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(t => t).slice(0, 10))
    console.log(`  Page buttons: ${JSON.stringify(btns)}`)
    fail('✕ button not found — session may not be active on landing page')
  }

  await browser.close()
  const failures = summary(t0)
  if (failures > 0) throw new Error(`${failures} step(s) failed`)
  return 0
}

// Retry up to 3 times on failure (OpenBSD Puppeteer timing issues)
async function runWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n🔄 Attempt ${attempt}/${maxRetries}`)
    try {
      await main()
      process.exit(0)
    } catch (err) {
      if (attempt < maxRetries) {
        console.log(`\n⚠️  Attempt ${attempt} failed: ${err.message?.slice(0, 80)}`)
        console.log('Waiting 30s before retry...')
        await new Promise(r => setTimeout(r, 30000))
      } else {
        console.error(`\n❌ All ${maxRetries} attempts failed`)
        process.exit(1)
      }
    }
  }
}

runWithRetry()
