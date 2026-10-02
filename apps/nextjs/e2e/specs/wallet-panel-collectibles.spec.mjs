#!/usr/bin/env node
// Evidencia que la billetera de la aplicación muestra sus **coleccionables**
// (credenciales/SBT) en el panel, que es lo que promete la guía 2 del curso
// Web3 & UBI (`resources/en/web3-and-ubi/guide2.md`, "Step 4: Your collectibles").
// https://github.com/pasosdeJesus/learn.tg/issues/249
//
// Hueco que cierra: el panel lee los NFTs **por dirección** desde Blockscout
// (`components/WalletPanel.tsx` -> `lib/wallet-amounts.ts`), así que debería
// funcionar igual con la billetera in-app o con una externa, pero ningún spec
// pulsaba la pestaña de coleccionables (`in-app-wallet-payments.spec.mjs` sólo
// cubre saldos/recibir/enviar y el unit sólo comprueba que no se piden al abrir).
//
// Usa la billetera de `apps/.env` (tiene credenciales en Celo Sepolia): la importa
// en la billetera de la aplicación por la UI, la desbloquea, abre el panel, entra a
// la pestaña "Coleccionables" y compara lo que muestra con lo que reporta el
// explorador para esa misma dirección.
//
// Run: CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=wallet-panel-collectibles

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, newIncognitoContext,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const password = '12345678'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadEnv() {
  const candidates = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    const env = fs.readFileSync(p, 'utf8')
    const g = (k) => env.match(new RegExp(`${k}=\"?([^\"\\n]+)\"?`))?.[1]
    const pk = g('PRIVATE_KEY')
    if (pk) {
      return { pk, addr: g('NEXT_PUBLIC_ADDRESS'), network: g('NEXT_PUBLIC_NETWORK') }
    }
  }
  return null
}

async function exists(page, selector) {
  try {
    return !!(await page.$(selector))
  } catch {
    return false
  }
}

function explorerBase(network) {
  return network === 'celo' ? 'https://celo.blockscout.com' : 'https://celo-sepolia.blockscout.com'
}

/** Credenciales que el explorador reporta para la dirección (fuente de verdad). */
async function explorerCredentials(address, network) {
  const url = `${explorerBase(network)}/api/v2/addresses/${address}/nft?type=ERC-721,ERC-1155`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`explorer ${res.status} ${url}`)
  const json = await res.json()
  return (json.items || []).map((i) => i.metadata?.name || i.token?.name || '(sin nombre)')
}

/** Responde el paso de protección (R-#269) si aparece. */
async function chooseProtection(page) {
  const step = await page
    .waitForSelector('[data-testid="wallet-protect"]', { timeout: 5000 })
    .catch(() => null)
  if (!step) return false
  await page.click('[data-testid="wallet-protect-password"]').catch(() => {})
  await page.click('[data-testid="wallet-protect-continue"]').catch(() => {})
  return true
}

async function importInAppWallet(page, privateKey) {
  for (let attempt = 0; attempt < 15; attempt++) {
    await page.click('[data-testid="wallet-open-dialog"]').catch(() => {})
    const opened = await page
      .waitForSelector('[data-testid="wallet-mode-import"]', { timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    if (opened) break
    if (attempt === 14) return false
  }
  await page.click('[data-testid="wallet-mode-import"]')
  await page.waitForSelector('[data-testid="wallet-private-key"]', { timeout: 15000 })
  await page.type('[data-testid="wallet-private-key"]', privateKey)
  await page.type('[data-testid="wallet-password"]', password)
  await page.click('[data-testid="wallet-import"]')
  await chooseProtection(page)
  return true
}

async function headerSignedIn(page) {
  return !!(await exists(page, '[data-testid="wallet-selector-in-app"]'))
}

/**
 * Abre el panel de la billetera. Con la billetera bloqueada (el SIWE de la
 * importación recarga la página) la píldora abre el diálogo: se desbloquea con la
 * contraseña y se vuelve a pulsar.
 */
async function openPanel(page) {
  for (let i = 0; i < 25; i++) {
    if (await exists(page, '[data-testid="wallet-panel"]')) return true
    await page.click('[data-testid="wallet-open-dialog"]').catch(() => {})
    await sleep(800)
    if (await exists(page, '[data-testid="wallet-panel"]')) return true
    if (await exists(page, '[data-testid="wallet-dialog"]')) {
      await page.waitForSelector('[data-testid="wallet-password"]', { timeout: 8000 }).catch(() => null)
      await page.type('[data-testid="wallet-password"]', password).catch(() => {})
      await page.click('[data-testid="wallet-unlock"]').catch(() => {})
      await sleep(3000)
    }
  }
  return exists(page, '[data-testid="wallet-panel"]')
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnv()
  if (!creds || !creds.pk) {
    console.error('No credentials found in apps/.env')
    process.exit(1)
  }
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const network = creds.network || (process.env.CHAIN_ID === '42220' ? 'celo' : 'celoSepolia')

  const env = await initTestEnv()
  const { base } = resolveSiteTarget(env)

  console.log(`Panel de la billetera: coleccionables | ${base} (${network})\n`)
  console.log(`Billetera: ${creds.addr}\n`)

  const expected = await explorerCredentials(creds.addr, network).catch((e) => {
    console.log(`  [diag] no se pudo consultar el explorador: ${e.message}`)
    return null
  })
  if (expected) console.log(`  [diag] el explorador reporta ${expected.length} credencial(es): ${expected.join(', ')}\n`)

  const browser = await launchBrowser(env.headless)
  const incognito = await newIncognitoContext(browser)
  const page = await incognito.newPage()
  await page.setDefaultNavigationTimeout(180000)

  const nftApi = []
  page.on('response', (res) => {
    const url = res.url()
    if (url.includes('/api/v2/addresses/') && url.includes('/nft')) {
      nftApi.push({ url: url.split('/api/v2')[1], status: res.status() })
    }
  })

  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(6000)

  if (!(await headerSignedIn(page))) {
    const imported = await importInAppWallet(page, creds.pk)
    if (!imported) {
      fail('No se pudo abrir el diálogo de importación de la billetera in-app')
      await browser.close()
      const failures = summary(t0)
      process.exit(failures > 0 ? 1 : 0)
    }
    for (let i = 0; i < 40 && !(await headerSignedIn(page)); i++) await sleep(1500)
  }
  if (await headerSignedIn(page)) ok('Billetera in-app importada y autenticada')
  else fail('La billetera in-app no quedó autenticada')

  if (!(await openPanel(page))) {
    fail('No se pudo abrir el panel de la billetera in-app')
    await browser.close()
    const failures = summary(t0)
    process.exit(failures > 0 ? 1 : 0)
  }
  ok('El panel de la billetera in-app se abrió')

  await page.click('[data-testid="wallet-panel-tab-collectibles"]').catch(() => {})
  let panelCount = 0
  let noNfts = false
  let nftsError = false
  for (let i = 0; i < 20; i++) {
    await sleep(1000)
    if (await exists(page, '[data-testid="wallet-panel-nfts"]')) {
      panelCount = await page
        .$$eval('[data-testid="wallet-panel-nfts"] li', (els) => els.length)
        .catch(() => 0)
      if (panelCount > 0) break
    }
    if (await exists(page, '[data-testid="wallet-panel-no-nfts"]')) {
      const noText = await page
        .$eval('[data-testid="wallet-panel-no-nfts"]', (el) => el.textContent || '')
        .catch(() => '')
      noNfts = true
      nftsError = !/No collectibles|No se encontraron/i.test(noText)
      break
    }
  }

  console.log(`  [diag] panel: ${panelCount} coleccionable(s) | vacío: ${noNfts} | error: ${nftsError}`)
  if (nftApi.length) {
    console.log(`  [diag] llamadas al explorador desde la página: ${JSON.stringify(nftApi)}`)
  } else {
    console.log('  [diag] la página NO llamó al explorador al abrir la pestaña')
  }

  if (!noNfts && panelCount > 0) {
    const names = await page
      .$$eval('[data-testid="wallet-panel-nfts"] li span', (els) =>
        els.map((e) => (e.textContent || '').trim()).filter(Boolean),
      )
      .catch(() => [])
    ok(`La billetera in-app muestra ${panelCount} coleccionable(s): ${names.join(', ')}`)
  } else if (expected && expected.length > 0) {
    fail(
      `La billetera in-app NO muestra las credenciales que el explorador reporta ` +
      `(${creds.addr}): esperadas ${expected.length}, mostradas ${panelCount}` +
      (noNfts ? ' (pestaña "sin coleccionables")' : ''),
    )
  } else if (nftsError) {
    fail('El panel mostró el estado de error de coleccionables')
  } else {
    ok('La billetera no tiene credenciales que mostrar (nada que evidencie)')
  }

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
