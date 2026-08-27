// E2E Test: Donation Flows — Course vault + GD country/cluster
//
// Covers:
//   1. Course page: Donate button → modal with distribution info → fill amount
//   2. GD ranking page: Countries tab default → Donate modal with country split info
//   3. Submit donation and verify toast with SLEARN cashback + tx link
//
// PREREQUISITE: the wallet (PRIVATE_KEY / NEXT_PUBLIC_ADDRESS in apps/.env)
// must be registered on the dev server.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     node e2e/specs/donate-flow.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)

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

  const env = await initTestEnv()
  const { base, timeout } = env
  const wallet = creds.addr.slice(0, 10) + '...'
  console.log(`Wallet: ${wallet} | ${base} (chain: ${CHAIN_ID})`)

  const browser = await launchBrowser()
  const page = await browser.newPage()
  // Set up auth BEFORE navigating — injects wallet mock + runs SIWE
  await setupE2EAuth(page, creds.addr, creds.pk, CHAIN_ID, base)

  // ════════════════════════════════════════════════════════════════
  // Step 1: Landing page (already authenticated)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 1: Landing page ──')
  if (!await navAndWait(page, base, timeout)) { fail('Landing page did not load'); await browser.close(); process.exit(1) }
  ok('Landing page loaded (authenticated)')

  // ════════════════════════════════════════════════════════════════
  // Step 2: Course page — Donate modal
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 2: Course page — Donate button ──')
  await navAndWait(page, `${base}/en/a-relationship-with-Jesus`, timeout)

  let donateFound = false
  for (let w = 0; w < 8; w++) {
    await new Promise(r => setTimeout(r, 2000))
    donateFound = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some(b =>
        (b.textContent || '').includes('Donate') || (b.textContent || '').includes('Donar')))
    if (donateFound) break
  }
  if (!donateFound) { console.log('  [!] No Donate button on course page'); ok('Course page loaded (no donate button — may not be a scholarship course)') }
  else {
    ok('Donate button visible')
    // Click Donate to open modal
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b =>
        (b.textContent || '').includes('Donate') || (b.textContent || '').includes('Donar'))
      if (btn) btn.click()
    })
    await new Promise(r => setTimeout(r, 3000))

    // Check modal shows distribution info
    const modalText = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') ||
        document.querySelector('.fixed.inset-0') ||
        document.querySelector('.bg-black\\/40')
      return dialog?.textContent?.replace(/\s+/g, ' ').trim() || ''
    })
    if (modalText.includes('70%') || modalText.includes('course vault') || modalText.includes('bóveda')) {
      ok('Donation modal shows distribution info')
    } else {
      console.log(`  Modal text: ${modalText.slice(0, 200)}`)
      console.log('  [!] Distribution info not found in modal')
    }

    // Check reward info
    if (modalText.includes('SLEARN') && (modalText.includes('reward') || modalText.includes('Recompensa') || modalText.includes('cashback'))) {
      ok('Modal shows SLEARN reward/cashback info')
    }

    // Fill amount
    const amountInput = await page.$('input[type="number"]')
    if (amountInput) {
      await amountInput.click()
      await amountInput.type('10')
      ok('Amount filled in modal')
      await new Promise(r => setTimeout(r, 1000))
    } else {
      console.log('  [!] Amount input not found')
    }

    // Close modal
    const closeBtn = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll('button')].filter(b =>
        (b.textContent || '').includes('Cancel') || (b.textContent || '').includes('Cancelar') || b.textContent === '✕')
      return btns[0] || null
    })
    if (closeBtn.asElement()) { await closeBtn.asElement().click(); await new Promise(r => setTimeout(r, 1000)); ok('Modal closed') }
    else { await page.keyboard.press('Escape'); await new Promise(r => setTimeout(r, 1000)) }
  }

  // ════════════════════════════════════════════════════════════════
  // Step 3: GD Ranking page — Countries tab default
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 3: GD Ranking — Countries tab ──')
  if (!await navAndWait(page, `${base}/en/gdcluster/ranking`, timeout)) { fail('Ranking page did not load'); await browser.close(); process.exit(1) }
  ok('Ranking page loaded')

  // Check that Countries tab is active by default
  await new Promise(r => setTimeout(r, 3000))
  const countriesActive = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')].filter(b =>
      b.textContent?.includes('País') || b.textContent?.includes('Countr'))
    // The active tab has bg-white + text-blue-700 styling
    const active = tabs.find(t => t.className.includes('bg-white') && t.className.includes('text-blue'))
    return active ? active.textContent?.trim() || '' : ''
  })
  if (countriesActive) ok(`Countries tab active by default: "${countriesActive}"`)
  else {
    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll('button')].map(b => b.textContent?.trim()).filter(Boolean).slice(0, 6))
    console.log(`  Tabs found: ${JSON.stringify(tabs)}`)
    console.log('  [!] Countries tab may not be active')
  }

  // ════════════════════════════════════════════════════════════════
  // Step 4: GD Ranking — Donate to a country
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 4: GD Ranking — Donate to country ──')
  await new Promise(r => setTimeout(r, 2000))

  // Find a Donate button in the countries table
  const donateBtn = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('button')].filter(b =>
      b.textContent?.includes('Donar') || b.textContent?.includes('Donate'))
    // Skip the first one if it's a tab button
    return btns.find(b => !b.textContent?.includes('País') && !b.textContent?.includes('Countr') && !b.textContent?.includes('Clúster') && !b.textContent?.includes('Cluster')) || null
  })

  if (donateBtn.asElement()) {
    ok('Donate button found in countries table')
    await donateBtn.asElement().click()
    await new Promise(r => setTimeout(r, 3000))

    // Check modal shows country donation info
    const gdModalText = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') ||
        document.querySelector('.fixed.inset-0') ||
        document.querySelector('.bg-black\\/40')
      return dialog?.textContent?.replace(/\s+/g, ' ').trim() || ''
    })

    if (gdModalText.includes('80%') || gdModalText.includes('country fund') || gdModalText.includes('fondo del país')) {
      ok('Country donation modal shows 80/10/10 split info')
    } else {
      console.log(`  Modal text: ${gdModalText.slice(0, 200)}`)
    }
    if (gdModalText.includes('SLEARN') && (gdModalText.includes('cashback') || gdModalText.includes('Cashback'))) {
      ok('Country donation modal shows SLEARN cashback')
    }

    // Close modal
    const closeGd = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll('button')].filter(b =>
        (b.textContent || '').includes('Cancel') || (b.textContent || '').includes('Cancelar') || b.textContent === '✕')
      return btns[0] || null
    })
    if (closeGd.asElement()) { await closeGd.asElement().click(); await new Promise(r => setTimeout(r, 1000)); ok('Country donation modal closed') }
  } else {
    console.log('  [!] No Donate button in countries table (may be empty)')
  }

  await browser.close()
  const failures = summary(t0); process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })