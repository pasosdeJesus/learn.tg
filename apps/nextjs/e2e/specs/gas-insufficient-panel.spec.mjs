// E2E Test: Gas insufficient panel (GasInsufficientPanel) in donation modal
//
// Verifica el comportamiento implementado para donaciones/pagos sin CELO:
// cuando el usuario no tiene CELO suficiente para el gas, el modal se
// reemplaza por el panel "Se necesita CELO para completar esta transacción"
// con enlace al curso Web3 & UBI (Guía 2) y botón Cerrar.
//
// Escenarios:
//   1. Con CELO suficiente → el formulario del modal se mantiene ("Enough gas estimated")
//   2. Sin CELO (mock eth_getBalance → 100 wei) → aparece el panel (EN) con
//      enlace a /en/web3-and-ubi/guide2; Cerrar cierra el modal
//   3. Panel en español (ranking /es) con enlace a /es/web3-e-ibu/guia2
//
// PREREQUISITE: the wallet (PRIVATE_KEY / NEXT_PUBLIC_ADDRESS in apps/.env)
// must be registered on the dev server.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     node e2e/specs/gas-insufficient-panel.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
// mock inyectado por e2e-auth: eth_getBalance → 1 CELO (gas suficiente)
const CELO_OK = '0x0DE0B6B3A7640000'
// 100 wei → insuficiente para el gas estimado (500000 gas × 5 gwei)
const CELO_LOW = '0x64'

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
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const bodyLen = await page.evaluate(() =>
      document.body?.textContent?.replace(/\s+/g, '').length || 0)
    if (bodyLen > 100) return true
  }
  return false
}

// Parchea eth_getBalance del proveedor inyectado (mismo objeto window.ethereum,
// así la referencia del transport de viem sigue apuntando al provider parcheado).
async function patchCeloBalance(page, hexBalance) {
  await page.evaluate((bal) => {
    const orig = window.ethereum.request.bind(window.ethereum)
    window.ethereum.request = async ({ method, params }) =>
      method === 'eth_getBalance' ? bal : orig({ method, params })
  }, hexBalance)
  console.log(`  [mock] eth_getBalance → ${hexBalance}`)
}

async function openDonateModal(page, lang) {
  for (let w = 0; w < 8; w++) {
    await new Promise(r => setTimeout(r, 2000))
    const found = await page.evaluate((l) =>
      [...document.querySelectorAll('button')].some(b =>
        (b.textContent || '').includes(l === 'es' ? 'Donar' : 'Donate')))
    if (found) break
  }
  await page.evaluate((l) => {
    const btn = [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes(l === 'es' ? 'Donar' : 'Donate'))
    if (btn) btn.click()
  })
  await new Promise(r => setTimeout(r, 3000))
}

async function fillUsdtAmount(page, value) {
  const input = await page.$('input[type="number"]')
  if (!input) return false
  await input.click()
  await input.type(String(value))
  await new Promise(r => setTimeout(r, 1500))
  return true
}

function modalText(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') ||
      document.querySelector('.fixed.inset-0') ||
      document.querySelector('.bg-black\\/40')
    return dialog?.textContent?.replace(/\s+/g, ' ').trim() || ''
  })
}

async function closeModal(page) {
  const closeBtn = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('button')].filter(b =>
      (b.textContent || '').includes('Cancel') || (b.textContent || '').includes('Cancelar')
      || (b.textContent || '').includes('Close') || (b.textContent || '').includes('Cerrar')
      || b.textContent === '✕')
    return btns[0] || null
  })
  if (closeBtn.asElement()) { await closeBtn.asElement().click() } else { await page.keyboard.press('Escape') }
  await new Promise(r => setTimeout(r, 1500))
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  const env = await initTestEnv()
  const { base, timeout } = env
  console.log(`Wallet: ${creds.addr.slice(0, 10)}... | ${base} (chain: ${CHAIN_ID})`)

  const browser = await launchBrowser()
  const page = await browser.newPage()
  await setupE2EAuth(page, creds.addr, creds.pk, CHAIN_ID, base)

  // ════════════════════════════════════════════════════════════════
  // Step 1: Course page — modal con CELO suficiente (regresión)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 1: Curso — CELO suficiente, el formulario se mantiene ──')
  if (!await navAndWait(page, `${base}/en/a-relationship-with-Jesus`, timeout)) {
    fail('Course page did not load'); await browser.close(); process.exit(1)
  }
  await openDonateModal(page, 'en')
  if (!await fillUsdtAmount(page, 1)) {
    fail('Amount input not found (modal not open)'); await browser.close(); process.exit(1)
  }
  const okText = await modalText(page)
  if (okText.includes('Enough gas estimated')) ok('Con CELO suficiente el formulario se mantiene ("Enough gas estimated")')
  else { console.log(`  Modal text: ${okText.slice(0, 160)}`); fail('Formulario esperado con CELO suficiente') }
  await closeModal(page)

  // ════════════════════════════════════════════════════════════════
  // Step 2: Sin CELO → el modal se reemplaza por el panel (EN)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 2: Sin CELO → panel "Se necesita CELO" (EN) ──')
  await patchCeloBalance(page, CELO_LOW)
  await openDonateModal(page, 'en')
  if (!await fillUsdtAmount(page, 1)) {
    fail('Amount input not found'); await browser.close(); process.exit(1)
  }
  const panelText = await modalText(page)
  if (panelText.includes('CELO is needed to complete this transaction')) {
    ok('Panel mostrado: "CELO is needed to complete this transaction"')
  } else { console.log(`  Modal text: ${panelText.slice(0, 200)}`); fail('Panel CELO no apareció (EN)') }
  if (panelText.includes('Go to the Web3 & UBI course')) ok('Panel incluye botón "Go to the Web3 & UBI course"')
  if (panelText.includes('After claiming CELO, come back and try again')) ok('Panel incluye hint 💡')

  const courseLink = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find(x => (x.textContent || '').includes('Web3 & UBI course'))
    return a ? a.getAttribute('href') : null
  })
  if (courseLink === '/en/web3-and-ubi/guide2') ok(`Enlace a Guía 2 correcto: ${courseLink}`)
  else { console.log(`  Link: ${courseLink}`); fail('Enlace a Guía 2 incorrecto') }

  // Cerrar cierra el modal
  await closeModal(page)
  const afterClose = await modalText(page)
  if (!afterClose.includes('CELO is needed')) ok('Cerrar cierra el panel/modal')
  else fail('El modal no se cerró con Cerrar')

  // ════════════════════════════════════════════════════════════════
  // Step 3: Ranking /es — panel en español con enlace a guia2
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 3: Ranking /es — panel en español ──')
  if (!await navAndWait(page, `${base}/es/gdcluster/ranking`, timeout)) {
    fail('Ranking page did not load'); await browser.close(); process.exit(1)
  }
  await patchCeloBalance(page, CELO_LOW)
  await openDonateModal(page, 'es')
  if (!await fillUsdtAmount(page, 1)) {
    fail('Amount input not found'); await browser.close(); process.exit(1)
  }
  const esText = await modalText(page)
  if (esText.includes('Se necesita CELO para completar esta transacción')) {
    ok('Panel mostrado en español')
  } else { console.log(`  Modal text: ${esText.slice(0, 200)}`); fail('Panel CELO no apareció (ES)') }
  const esLink = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find(x => (x.textContent || '').includes('curso Web3 & UBI'))
    return a ? a.getAttribute('href') : null
  })
  if (esLink === '/es/web3-e-ibu/guia2') ok(`Enlace español a Guía 2 correcto: ${esLink}`)
  else { console.log(`  Link: ${esLink}`); fail('Enlace español incorrecto') }
  await closeModal(page)

  await browser.close()
  const failures = summary(t0); process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
