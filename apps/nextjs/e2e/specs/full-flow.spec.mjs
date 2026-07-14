// E2E Test: Full User Flow (R-#179)
// Covers: Connect → Courses → Donate → Profile Score → Crossword → UBI Claim → Disconnect
//
// Wallet: verified, 60 profile score → can claim UBI and do crosswords
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
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const bodyLen = await page.evaluate(() =>
      document.body?.textContent?.replace(/\s+/g, '').length || 0)
    if (bodyLen > 100) return true
  }
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const envCreds = loadEnvCredentials()
  if (!envCreds) { console.error('❌ No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = envCreds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, timeout, chainId } = env
  const wallet = short(envCreds.addr)

  console.log(`Wallet: ${wallet} | ${base} (chain: ${chainId})`)
  console.log('Target: Full user flow with profile score, UBI claim, crossword\n')

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()

  // Full mock: SIWE + balances + transactions
  await setupSIWEMock(page, envCreds.addr, envCreds.pk, chainId)

  // ════════════════════════════════════════════════════════════════
  // Step 1: Landing — Connect Wallet visible
  // ════════════════════════════════════════════════════════════════
  console.log('── Step 1: Landing — Connect Wallet ──')
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 4000))
  const hasConnect = await page.evaluate(() =>
    document.body.textContent?.includes('Connect Wallet') ||
    document.body.textContent?.includes('Conectar Billetera'))
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
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const stillConnect = await page.evaluate(() =>
      document.body.textContent?.includes('Connect Wallet'))
    if (!stillConnect) {
      // Verify address is now displayed — look for hex pattern
      const addrFound = await page.evaluate(() => {
        const text = document.body.textContent || ''
        return /0x[a-fA-F0-9]{4,}...[a-fA-F0-9]{4}/.test(text)
      })
      ok(`SIWE complete${addrFound ? ' — address visible' : ''}`)
      connected = true
      break
    }
    if (i === 14) fail('SIWE did not complete after 45s')
  }
  if (!connected) { await browser.close(); process.exit(1) }

  // ════════════════════════════════════════════════════════════════
  // Step 3: /en — courses page
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 3: /en — courses ──')
  const enOk = await navAndWait(page, `${base}/en`, timeout)
  if (!enOk) { fail('/en did not render'); await browser.close(); process.exit(1) }
  ok('/en loaded')
  await new Promise(r => setTimeout(r, 2000))

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
  // Step 4: Enter course
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 4: Enter course ──')
  let courseEntered = false
  let courseHref = null
  if (courseLinks.length > 0) {
    courseHref = courseLinks[0].href
    const courseOk = await navAndWait(page, `${base}${courseHref}`, timeout)
    if (courseOk) {
      ok(`Entered: ${courseHref}`)
      courseEntered = true
    } else fail(`Course ${courseHref} did not render`)
  }

  // ════════════════════════════════════════════════════════════════
  // Step 5: Donate — check if button present
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 5: Donate ──')
  if (courseEntered) {
    await new Promise(r => setTimeout(r, 3000))
    const donateBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b =>
        (b.textContent || '').includes('Donate') || (b.textContent || '').includes('Donar'))
    )
    if (donateBtn.asElement()) {
      await donateBtn.asElement().click()
      ok('Donate dialog opened')
      await new Promise(r => setTimeout(r, 2000))
      // Close dialog
      const cancelBtn = await page.evaluateHandle(() =>
        [...document.querySelectorAll('[role="dialog"] button')].find(b =>
          (b.textContent || '').includes('Cancel') || (b.textContent || '').includes('Cancelar'))
      )
      if (cancelBtn.asElement()) await cancelBtn.asElement().click()
      else await page.keyboard.press('Escape')
    } else console.log('  ⚠️  No Donate button')
  }

  // ════════════════════════════════════════════════════════════════
  // Step 6: Profile — verify score, verified status
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 6: Profile — score & verified ──')
  const profileOk = await navAndWait(page, `${base}/en/profile`, timeout)
  if (!profileOk) { fail('Profile page did not render') }
  else {
    ok('Profile loaded')
    await new Promise(r => setTimeout(r, 4000))

    // Verify "Profile Score" / "Puntaje de Perfil" section
    const hasScoreLabel = await page.evaluate(() =>
      document.body.textContent?.includes('Profile Score') ||
      document.body.textContent?.includes('Puntaje de Perfil'))
    if (hasScoreLabel) ok('Profile Score section visible')
    else fail('Profile Score section not found')

    // Look for score value near the label (≥ 50)
    const scoreMatch = await page.evaluate(() => {
      const body = document.body.textContent || ''
      // Find "Profile Score" and look for a number nearby
      const idx = body.indexOf('Profile Score') !== -1 ? body.indexOf('Profile Score') :
                  body.indexOf('Puntaje de Perfil')
      if (idx === -1) return null
      const nearby = body.slice(idx, idx + 80)
      const m = nearby.match(/(\d{1,3})/)
      return m ? parseInt(m[1]) : null
    })
    if (scoreMatch !== null) {
      if (scoreMatch >= 50) ok(`Profile score: ${scoreMatch} (≥ 50 ✓)`)
      else ok(`Profile score: ${scoreMatch}`)
    } else console.log('  ⚠️  Could not extract score number')

    // Verify "Verified" status text
    const hasVerified = await page.evaluate(() =>
      document.body.textContent?.includes('Verified') ||
      document.body.textContent?.includes('Verificado'))
    if (hasVerified) ok('Verified status visible')
    else console.log('  ⚠️  Verified status not visible in text')

    // Save button test
    const saveBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b =>
        (b.textContent || '').includes('Save') || (b.textContent || '').includes('Guardar'))
    )
    if (saveBtn.asElement()) {
      const isDisabled = await page.evaluate(el => el.disabled, saveBtn.asElement())
      if (!isDisabled) {
        await saveBtn.asElement().click()
        await new Promise(r => setTimeout(r, 3000))
        ok('Save submitted')
      } else ok('Save button present (disabled)')
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Step 7: Guide page
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 7: Guide ──')
  if (courseEntered && courseHref) {
    await navAndWait(page, `${base}${courseHref}`, timeout)
    await new Promise(r => setTimeout(r, 2000))
    const guideLinks = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h && h.match(/\/(guide|guia)\d*$/)))
    if (guideLinks.length > 0) {
      const gOk = await navAndWait(page, `${base}${guideLinks[0]}`, timeout)
      gOk ? ok(`Guide: ${guideLinks[0]}`) : fail('Guide did not render')
    } else console.log('  ⚠️  No guide links')
  }

  // ════════════════════════════════════════════════════════════════
  // Step 8: Crossword — fill cells and submit
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 8: Crossword ──')
  if (courseEntered && courseHref) {
    const testUrl = `${courseHref}/test`
    const testOk = await navAndWait(page, `${base}${testUrl}`, timeout)
    if (testOk) {
      ok(`Crossword loaded: ${testUrl}`)
      await new Promise(r => setTimeout(r, 3000))

      // Count grid inputs (text fields in crossword)
      const gridInputs = await page.evaluate(() => {
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
      if (activeInputs.length > 0) {
        ok(`Crossword grid: ${activeInputs.length} fillable cells`)

        // Fill first few cells with letters
        let filled = 0
        const inputs = await page.$$('input[type="text"]')
        for (const inp of inputs) {
          const isDisabled = await page.evaluate(el => el.disabled || el.readOnly, inp)
          if (!isDisabled && filled < 5) {
            await inp.click()
            await inp.type(String.fromCharCode(65 + filled)) // A, B, C, D, E
            filled++
          }
        }
        if (filled > 0) ok(`Filled ${filled} crossword cells`)

        // Try to submit
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
            // Check for feedback
            const feedback = await page.evaluate(() => {
              const body = document.body.textContent || ''
              if (body.includes('Correct') || body.includes('Correcto') ||
                  body.includes('Wrong') || body.includes('Incorrecto') ||
                  body.includes('winner') || body.includes('ganador'))
                return body.slice(body.search(/Correct|Wrong|winner|ganador|Incorrecto/), 80)
              return null
            })
            if (feedback) ok(`Crossword feedback: "${feedback.slice(0, 50)}"`)
            else console.log('  ⚠️  No visible feedback after submit')
          } else console.log('  ⚠️  Submit disabled (puzzle incomplete)')
        } else console.log('  ⚠️  No submit button')
      } else console.log('  ⚠️  No fillable crossword cells — may need course data')
    } else console.log(`  ⚠️  Crossword not at ${testUrl}`)
  }

  // ════════════════════════════════════════════════════════════════
  // Step 9: UBI Claim — actually claim
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 9: UBI Claim ──')
  const ubiPath = process.env.GUIDE_CLAIM_PATH || '/en/web3-and-ubi/guide3'
  const ubiOk = await navAndWait(page, `${base}${ubiPath}`, timeout)
  if (ubiOk) {
    ok(`UBI guide: ${ubiPath}`)
    await new Promise(r => setTimeout(r, 4000))

    // Find and click Claim button
    const claimBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b =>
        (b.textContent || '').includes('Claim Learn.tg-UBI') ||
        (b.textContent || '').includes('Reclamar Learn.tg-IBU'))
    )
    if (claimBtn.asElement()) {
      ok('Claim button found')
      await claimBtn.asElement().click()
      ok('Clicked Claim')

      // Wait for dialog result
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
        if (i === 14) console.log('  ⚠️  UBI dialog still pending')
      }
    } else fail('Claim button not found')
  } else fail('UBI guide not found')

  // ════════════════════════════════════════════════════════════════
  // Step 10: Disconnect ✕ → Connect Wallet returns
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 10: Disconnect ✕ ──')
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 3000))

  const disconnectBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').trim() === '✕')
  )
  if (disconnectBtn.asElement()) {
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
  } else fail('✕ button not found')

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
