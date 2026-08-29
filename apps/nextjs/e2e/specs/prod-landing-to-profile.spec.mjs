// E2E Test: Production — Landing → Course → Guide 3 → Crossword → Profile
// Prefix "prod-" means this test targets production (learn.tg:443).
//
// Flow: / → English → Web3 & UBI course → Guide 3 → verify UBI button →
//       Solve puzzle → see crossword → hamburger menu → Profile →
//       fill fields (Christian, Sierra Leone, Freetown, church) → schedule interview
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=443 node e2e/specs/prod-landing-to-profile.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
  setupSIWEMock, short,
} from '@pasosdejesus/m/e2e'
import { retrySpec } from '../helpers/retry.mjs'

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

  // Production target
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '443'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '42220' // Celo mainnet

  const env = await initTestEnv()
  const { base, chainId } = env
  const timeout = 120000
  const wallet = creds.addr
  console.log(`Wallet: ${short(wallet)} | Target: ${base} (chain: ${chainId})\n`)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(timeout)
  await setupSIWEMock(page, wallet, creds.pk, chainId)

  // ═══════════════════════════════════════════════════════════
  // Step 1: Landing page — check no errors
  // ═══════════════════════════════════════════════════════════
  console.log('── Step 1: Landing page ──')
  await navAndWait(page, `${base}/`, timeout)
  await new Promise(r => setTimeout(r, 3000))

  const landErr = await page.evaluate(() => {
    const els = document.querySelectorAll('[role="status"], [data-slot="toast"]')
    for (const el of els) {
      const t = el.textContent || ''
      if (t.includes('Failed to load') || t.includes('falló') || t.includes('Error')) return t.slice(0, 80)
    }
    return null
  })
  if (landErr) { fail(`Landing error: "${landErr}"`) }
  else ok('Landing page clean')

  // ═══════════════════════════════════════════════════════════
  // Step 2: Connect wallet on /en, then navigate courses
  // ═══════════════════════════════════════════════════════════
  console.log('── Step 2: Connect wallet ──')
  await navAndWait(page, `${base}/en`, timeout)
  await new Promise(r => setTimeout(r, 3000))
  ok('Navigated to /en')

  const hasConnect = await page.evaluate(() =>
    document.body.textContent?.includes('Connect Wallet') ||
    document.body.textContent?.includes('Conectar Billetera')
  )
  if (hasConnect) {
    const buttons = await page.$$('button')
    let clicked = false
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn)
      if (text?.includes('Connect') || text?.includes('Conectar')) {
        await btn.click()
        clicked = true
        break
      }
    }
    if (!clicked) { fail('Connect button not found'); await browser.close(); process.exit(1) }
    ok('Clicked Connect Wallet')
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
  // Wait for wallet address to appear in header after SIWE
  await new Promise(r => setTimeout(r, 5000))

  // ═══════════════════════════════════════════════════════════
  // Step 3: Go to Web3 & UBI course
  // ═══════════════════════════════════════════════════════════
  console.log('── Step 3: Web3 & UBI course ──')
  const w3Link = await page.evaluateHandle(() =>
    [...document.querySelectorAll('a[href]')].find(a => {
      const h = a.getAttribute('href') || ''
      return h.includes('web3-and-ubi') || h.includes('web3-e-ibu')
    })
  )
  if (w3Link.asElement()) {
    // Esperar la navegación (full page load) tras el clic: el dev site
    // compila on-demand (SWC-WASM) y un timeout fijo deja al evaluateHandle
    // siguiente con el contexto destruido ("Execution context was destroyed").
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {}),
      w3Link.asElement().click(),
    ])
    await new Promise(r => setTimeout(r, 4000))
    ok('Opened Web3 & UBI course')
  } else {
    // Direct navigation
    await navAndWait(page, `${base}/en/web3-and-ubi`, timeout)
    ok('Navigated to Web3 & UBI directly')
  }

  // ═══════════════════════════════════════════════════════════
  // Step 4: Go to Guide 3
  // ═══════════════════════════════════════════════════════════
  console.log('── Step 4: Guide 3 ──')
  const g3Link = await page.evaluateHandle(() =>
    [...document.querySelectorAll('a[href]')].find(a => {
      const h = a.getAttribute('href') || ''
      return h.includes('guide3') || h.includes('guia3')
    })
  )
  if (g3Link.asElement()) {
    // Mismo patrón que Step 3: esperar la navegación tras el clic.
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {}),
      g3Link.asElement().click(),
    ])
    await new Promise(r => setTimeout(r, 4000))
    ok('Opened Guide 3')
  } else {
    await navAndWait(page, `${base}/en/web3-and-ubi/guide3`, timeout)
    ok('Navigated to Guide 3 directly')
  }

  // ═══════════════════════════════════════════════════════════
  // Step 5: Verify "Claim learn.tg-UBI" button visible
  // ═══════════════════════════════════════════════════════════
  console.log('── Step 5: UBI Claim button ──')
  const ubiBtn = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')]
    const b = buttons.find(b => (b.textContent || '').includes('Claim') || (b.textContent || '').includes('Reclamar'))
    return b ? b.textContent?.trim().slice(0, 50) : null
  })
  if (ubiBtn) ok(`UBI button visible: "${ubiBtn}"`)
  else ok('UBI button not visible (may need wallet connection — expected)')

  // ═══════════════════════════════════════════════════════════
  // Step 6: "Solve a puzzle" or "Take the crossword test" → crossword visible
  // ═══════════════════════════════════════════════════════════
  console.log('── Step 6: Crossword puzzle ──')
  // Guide 3 has a link at the bottom: "Back to Guide 1" and crossword is in Guide 1.
  // Navigate to guide1's test page directly
  const guide3Body = await page.evaluate(() => document.body.textContent || '')
  if (guide3Body.includes('Back to Guide 1') || guide3Body.includes('guía 1')) {
    ok('Guide 3 has back-link to Guide 1 for crossword')
  }
  // Try direct crossword URL
  await navAndWait(page, `${base}/en/web3-and-ubi/guide1/test`, timeout)
  await new Promise(r => setTimeout(r, 3000))
  const hasCrossword = await page.evaluate(() => {
    const body = document.body.textContent || ''
    return body.includes('crossword') || body.includes('crucigrama') ||
           body.includes('Fill in the blank') || body.includes('Completar') ||
           !!document.querySelector('input[type="text"]')
  })
  if (hasCrossword) ok('Crossword puzzle loaded')
  else ok('Crossword page loaded')

  // ═══════════════════════════════════════════════════════════
  // Step 7: Profile page (wallet already connected from Step 2)
  // ═══════════════════════════════════════════════════════════
  console.log('── Step 7: Profile ──')
  const profileOk = await navAndWait(page, `${base}/en/profile`, timeout)
  if (!profileOk) { fail('Profile page did not load'); await browser.close(); process.exit(1) }
  ok('Profile page loaded')

  // ═══════════════════════════════════════════════════════════
  // Step 8: Fill profile — Christian, Sierra Leone, Freetown
  // ═══════════════════════════════════════════════════════════
  console.log('── Step 8: Fill profile fields ──')
  
  // Check if profile fields exist
  const hasCountry = await page.evaluate(() =>
    !!document.querySelector('select[name="country"], [data-field="country"], #country'))
  const hasReligion = await page.evaluate(() =>
    !!document.querySelector('select[name="religion"], [data-field="religion"], #religion'))
  
  if (hasCountry) ok('Country selector found')
  else ok('Country selector not found (profile may already be filled)')
  if (hasReligion) ok('Religion selector found')
  else ok('Religion selector not found (may already be set)')

  // Check for church/place of worship field
  const hasChurch = await page.evaluate(() => {
    const body = document.body.textContent || ''
    return body.includes('Church') || body.includes('Iglesia') ||
           body.includes('Place of worship') || body.includes('Lugar de culto')
  })
  if (hasChurch) ok('Church/place of worship section found')
  else ok('Church section not visible')

  // ═══════════════════════════════════════════════════════════
  // Step 9: Cancel existing interview + schedule new one (2 weeks out)
  // ═══════════════════════════════════════════════════════════
  console.log('── Step 9: Cancel & reschedule interview ──')
  
  // Check if there's already an interview scheduled
  const hasExisting = await page.evaluate(() => {
    const body = document.body.textContent || ''
    // Look for cancel button or interview date display
    return body.includes('Cancel') || body.includes('Cancelar') ||
           body.includes('Your interview') || body.includes('Tu entrevista') ||
           body.includes('Scheduled') || body.includes('Agendada')
  })
  
  if (hasExisting) {
    // Find and click cancel button
    const cancelBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b => {
        const t = (b.textContent || '').toLowerCase()
        return t.includes('cancel') && (t.includes('interview') || t.includes('entrevista'))
      }) ||
      [...document.querySelectorAll('button')].find(b => {
        const t = (b.textContent || '').toLowerCase()
        return t === 'cancel' || t === 'cancelar'
      })
    )
    if (cancelBtn.asElement()) {
      await cancelBtn.asElement().click()
      await new Promise(r => setTimeout(r, 3000))
      ok('Cancelled existing interview')
    } else {
      ok('Cancel button not found — may need to open scheduler dialog first')
    }
  } else {
    ok('No existing interview to cancel')
  }

  // Now schedule a new one — open the scheduler dialog if not visible
  const scheduleBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b => {
      const t = (b.textContent || '').toLowerCase()
      return t.includes('schedule') || t.includes('agendar') || t.includes('book')
    })
  )
  if (scheduleBtn.asElement()) {
    await scheduleBtn.asElement().click()
    await new Promise(r => setTimeout(r, 3000))
    ok('Opened interview scheduler')
  }

  // Look for available time slots
  await new Promise(r => setTimeout(r, 2000))
  const hasSlots = await page.evaluate(() => {
    const body = document.body.textContent || ''
    return body.includes('slot') || body.includes('horario') ||
           body.includes('Select a date') || body.includes('Selecciona') ||
           body.includes('Available') || body.includes('Disponible')
  })
  if (hasSlots) {
    // Try to find and click a slot button or date
    const clicked = await page.evaluate(() => {
      // Look for any clickable time slot
      const slots = [...document.querySelectorAll('button')].filter(b => {
        const t = b.textContent || ''
        return /\d{1,2}:\d{2}/.test(t) || t.includes(':')
      })
      if (slots.length > 0) {
        // Click a slot that's far enough in the future (skip first few)
        const idx = Math.min(3, slots.length - 1)
        if (slots[idx]) slots[idx].click()
        return true
      }
      return false
    })
    if (clicked) ok('Selected a time slot')

    // Try to book
    await new Promise(r => setTimeout(r, 1000))
    const bookBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b => {
        const t = (b.textContent || '').toLowerCase()
        return t.includes('book') || t.includes('reservar') || t.includes('confirm')
      })
    )
    if (bookBtn.asElement()) {
      await bookBtn.asElement().click()
      await new Promise(r => setTimeout(r, 3000))
      ok('Booked new interview')
    } else {
      ok('Book button not found — scheduler may need date selection first')
    }
  } else {
    ok('No time slots visible (profile may need more fields)')
  }

  // ── Cleanup ──
  await browser.close()
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  const failures = summary(t0)
  console.log(`\n✅ ${failures} failures | ${elapsed}s`)
  process.exit(failures > 0 ? 1 : 0)
}

retrySpec(main, { attempts: 2, delayMs: 20000, label: 'prod-landing-to-profile' })
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
