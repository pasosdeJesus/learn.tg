#!/usr/bin/env node
// E2E: crossword answered offline, queued and synced when the connection returns
// (R-#242). It needs no service worker (the queue is IndexedDB + localStorage), so
// it also runs against a dev server:
//
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/offline-crossword.spec.mjs
//
// The wallet is the real `@learn-tg/pdj-wallet` core running in Node (R-#239).

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { installCoreWalletMock, signInWithCoreWallet } from '../helpers/in-app-wallet.mjs'

const GUIDE_PATH = '/en/gdcluster/guide1/test'
const password = '12345678'

function loadEnvCredentials() {
  for (const envPath of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Reads the queue straight from IndexedDB (`learn-tg-offline` → `pending`). */
async function pendingInIndexedDb(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('learn-tg-offline')
        request.onerror = () => resolve(-1)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('pending')) {
            resolve(0)
            return
          }
          const count = db.transaction('pending', 'readonly').objectStore('pending').count()
          count.onsuccess = () => resolve(count.result)
          count.onerror = () => resolve(-1)
        }
      }),
  )
}

async function pendingCount(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="offline-pending"]')
    const match = el?.textContent?.match(/^\s*(\d+)/)
    return match ? Number(match[1]) : 0
  })
}

async function fillEveryCell(page) {
  // One cell per task: React batches the synthetic events of a single
  // `evaluate`, so filling them all at once left the grid with a single letter
  // and the submit button disabled.
  const count = await page.evaluate(() => document.querySelectorAll('input[data-row]').length)
  for (let index = 0; index < count; index++) {
    // A Fast Refresh on the dev server can reload the page mid-fill: ignore that
    // error and keep going with the cells of the new document.
    await page
      .evaluate((position) => {
        const cell = document.querySelectorAll('input[data-row]')[position]
        if (!cell) return
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        setter.call(cell, 'A')
        cell.dispatchEvent(new Event('input', { bubbles: true }))
      }, index)
      .catch(() => {})
    await sleep(40)
  }
  return count
}

async function clickSubmit(page) {
  const buttons = await page.$$('button')
  for (const button of buttons) {
    const text = ((await button.evaluate((el) => el.textContent)) || '').trim()
    if (/^(Submit answer|Enviar respuesta)$/.test(text)) {
      const disabled = await button.evaluate((el) => el.disabled)
      if (disabled) return false
      await button.click()
      return true
    }
  }
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found in apps/.env'); process.exit(1) }

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, timeout, chainId } = env

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(120000)

  await installCoreWalletMock(page, { privateKey: creds.pk, address: creds.addr, chainId, password: password })
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await signInWithCoreWallet(page, { privateKey: creds.pk, address: creds.addr, chainId, baseUrl: base, password: password })
  ok('Signed in with the pdj-wallet core (session cookie)')

  console.log(`\nCrossword offline | ${base}${GUIDE_PATH}\n`)

  // 1. Online: the puzzle loads and is stored in localStorage.
  await page.goto(`${base}${GUIDE_PATH}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[data-row]', { timeout: timeout * 2 }).catch(() => {})
  const cells = await page.$$('input[data-row]')
  if (cells.length === 0) {
    console.log('[SKIP] el crucigrama de esa guía no está disponible (¿guía sin preguntas o sitio sin desplegar?)')
    await browser.close()
    process.exit(0)
  }
  ok(`Crossword rendered (${cells.length} cells)`)

  const storageKey = await page.evaluate(() =>
    Object.keys(localStorage).find((key) => key.startsWith('crossword-state-')) || null,
  )

  // 2. Fill it (the submit button stays disabled until every cell has a letter)
  const filled = await fillEveryCell(page)
  await sleep(500)
  ok(`Filled ${filled} cells`)

  // 3. Offline: the page is already loaded, so no reload is needed. Without the
  // service worker of R-#240 an offline *reload* cannot work at all; what makes
  // the crossword usable offline is the localStorage copy of the puzzle.
  await page.setOfflineMode(true)
  await sleep(1000)
  const offlineKey = await page
    .evaluate(() =>
      Object.keys(localStorage).find((key) => key.startsWith('crossword-state-')) || null,
    )
    .catch(() => storageKey)
  if (offlineKey) ok(`Puzzle state kept in localStorage (${offlineKey})`)
  else if (storageKey) fail('The crossword state in localStorage was lost')
  else console.log('  [i] the state is written on the first edit; nothing to compare')

  // 4. Submitting offline must queue, not fail
  const submitted = await clickSubmit(page)
  if (!submitted) {
    fail('Submit button was disabled offline (puzzle not completed?)')
  } else {
    for (let i = 0; i < 10; i++) {
      await sleep(1000)
      if ((await pendingCount(page)) > 0) break
    }
    const pending = await pendingCount(page)
    if (pending > 0) ok(`Answer queued offline (pending indicator shows ${pending})`)
    else fail('No pending indicator after submitting offline')
  }

  // 5. The queue is in IndexedDB, not in memory: that is what makes it survive a
  // reload. (The page cannot be reloaded while offline: without the R-#240
  // service worker there is no cached HTML to load from.)
  const queuedInDb = await pendingInIndexedDb(page)
  if (queuedInDb > 0) ok(`Queue persisted in IndexedDB (${queuedInDb} pending)`)
  else fail(`The queued answer is not in IndexedDB (count ${queuedInDb})`)

  // 6. The queue is replayed (the page listens for `online`)
  await page.setOfflineMode(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  let drained = 0
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    drained = await pendingCount(page)
    if (drained === 0) break
  }
  const dbAfterDrain = await pendingInIndexedDb(page)
  if (drained === 0 && dbAfterDrain === 0) {
    ok('Queue drained when the connection returned (indicator and IndexedDB empty)')
  } else {
    fail(`The queue still has ${drained} pending answer(s) (IndexedDB ${dbAfterDrain})`)
  }

  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
