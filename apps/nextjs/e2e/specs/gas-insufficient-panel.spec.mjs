// E2E Test: Gas insufficient panel (GasInsufficientPanel) in donation modal
//
// Verifica el comportamiento implementado para donaciones/pagos sin CELO:
// cuando el usuario no tiene CELO suficiente para el gas, el modal se
// reemplaza por el panel "Se necesita CELO para completar esta transacción"
// con enlace al curso Web3 & UBI (Guía 2) y botón Cerrar.
//
// Escenarios (modal de donación del ranking, abre sin gate de sesión):
//   1. Con CELO suficiente → el formulario se mantiene ("Enough gas estimated")
//   1b. CELO suficiente con eth_getBalance RETARDADO (latencia RPC simulada) →
//       el formulario NO es reemplazado por el panel (regresión de la carrera
//       de gas: la estimación corría con celo=0 antes de cargar el saldo)
//   2. Sin CELO (mock eth_getBalance → 100 wei) → el panel aparece de inmediato
//      al abrir (EN), con enlace a /en/web3-and-ubi/guide3; Cerrar cierra
//   3. Panel en español (ranking /es) con enlace a /es/web3-e-ibu/guia3
//
// PREREQUISITE: the wallet (PRIVATE_KEY / NEXT_PUBLIC_ADDRESS in apps/.env)
// must be registered on the dev server.
//
// Execution:
//   IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     CHROME_PATH=/usr/local/bin/chrome bin/m test:e2e gas-insufficient-panel

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
// 100 wei → insuficiente para el gas estimado (500000 gas × 5 gwei ≈ 0.0025 CELO)
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
// DEBE ejecutarse antes de abrir el modal (loadData corre al abrir).
async function patchCeloBalance(page, hexBalance) {
  await page.evaluate((bal) => {
    const orig = window.ethereum.request.bind(window.ethereum)
    window.ethereum.request = async ({ method, params }) =>
      method === 'eth_getBalance' ? bal : orig({ method, params })
  }, hexBalance)
  console.log(`  [mock] eth_getBalance → ${hexBalance}`)
}

// Parchea el proveedor para la regresión de la carrera de gas: saldo CELO
// suficiente con LATENCIA RPC simulada (balanceDelayMs) + eth_estimateGas y
// eth_gasPrice fijos. Sin parchear, el mock devuelve null y viem lanza
// "Cannot convert null to a BigInt" en getBalance/getGasPrice.
async function patchGasProvider(page, {
  balance, balanceDelayMs = 0, estimateGas, gasPrice,
}) {
  await page.evaluate((cfg) => {
    const orig = window.ethereum.request.bind(window.ethereum)
    window.ethereum.request = async ({ method, params }) => {
      if (method === 'eth_getBalance') {
        if (cfg.balanceDelayMs) await new Promise((r) => setTimeout(r, cfg.balanceDelayMs))
        return cfg.balance
      }
      if (method === 'eth_estimateGas' && cfg.estimateGas) return cfg.estimateGas
      if (method === 'eth_gasPrice' && cfg.gasPrice) return cfg.gasPrice
      return orig({ method, params })
    }
  }, { balance, balanceDelayMs, estimateGas, gasPrice })
  console.log(`  [mock] eth_getBalance → ${balance} (delay ${balanceDelayMs}ms), eth_estimateGas → ${estimateGas}, eth_gasPrice → ${gasPrice}`)
}

// Espera el texto del modal hasta que contenga uno de los marcadores o expire.
async function waitModalText(page, markers, timeoutMs = 12000) {
  const t0 = Date.now()
  let text = ''
  while (Date.now() - t0 < timeoutMs) {
    text = await modalText(page)
    if (markers.some((m) => text.includes(m))) break
    await new Promise((r) => setTimeout(r, 1000))
  }
  return text
}

// Espera el botón Donar/Donate de una fila y lo pulsa (click real por coordenadas).
async function clickDonateRow(page, lang) {
  const needle = lang === 'es' ? 'Donar' : 'Donate'
  for (let w = 0; w < 12; w++) {
    await new Promise(r => setTimeout(r, 2000))
    const box = await page.evaluate((n) => {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes(n))
      if (!b) return null
      const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
    }, needle)
    if (box && box.w > 0 && box.h > 0) {
      await page.mouse.click(box.x, box.y)
      await new Promise(r => setTimeout(r, 3000))
      const open = await page.evaluate(() => !!document.querySelector('.fixed.inset-0'))
      if (open) return true
    }
  }
  return false
}

async function fillUsdtAmount(page, value) {
  let input = null
  for (let w = 0; w < 10; w++) {
    input = await page.$('input[type="number"]')
    if (input) break
    await new Promise(r => setTimeout(r, 1500))
  }
  if (!input) return false
  await input.click()
  await input.type(String(value))
  await new Promise(r => setTimeout(r, 2000))
  return true
}

function modalText(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') ||
      document.querySelector('.fixed.inset-0')
    return dialog?.textContent?.replace(/\s+/g, ' ').trim() || ''
  })
}

async function closeModal(page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const closeBtn = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll('button')].filter(b =>
        b.getAttribute('aria-label') === 'Close' || b.getAttribute('aria-label') === 'Cerrar'
        || b.textContent?.includes('Close') || b.textContent?.includes('Cerrar')
        || b.textContent?.trim() === '✕')
      return btns[btns.length - 1] || null
    })
    if (closeBtn.asElement()) await closeBtn.asElement().click()
    else await page.keyboard.press('Escape')
    await new Promise(r => setTimeout(r, 2500))
    if (!(await page.evaluate(() => !!document.querySelector('.fixed.inset-0')))) return true
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
  console.log(`Wallet: ${creds.addr.slice(0, 10)}... | ${base} (chain: ${CHAIN_ID})`)

  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', (err) => console.log('  [pageerror]', String(err).slice(0, 250)))
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('  [console.error]', msg.text().slice(0, 250)) })
  await setupE2EAuth(page, creds.addr, creds.pk, CHAIN_ID, base)

  // ════════════════════════════════════════════════════════════════
  // Step 1: Ranking /en — CELO suficiente (regresión, sin parche)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 1: Ranking /en — CELO suficiente, el formulario se mantiene ──')
  if (!await navAndWait(page, `${base}/en/gdcluster/ranking`, timeout)) {
    fail('Ranking page did not load'); await browser.close(); process.exit(1)
  }
  await new Promise(r => setTimeout(r, 4000))
  if (!await clickDonateRow(page, 'en')) {
    const diag = await page.evaluate(() => ({
      donate: [...document.querySelectorAll('button')].filter(b => (b.textContent || '').includes('Donate')).length,
      overlay: !!document.querySelector('.fixed.inset-0'),
      bodyLen: document.body?.textContent?.length || 0,
    }))
    console.log('  DIAG:', JSON.stringify(diag))
    fail('Donar button not found / modal not open'); await browser.close(); process.exit(1)
  }
  if (!await fillUsdtAmount(page, 1)) {
    fail('Amount input not found'); await browser.close(); process.exit(1)
  }
  const okText = await modalText(page)
  if (okText.includes('Enough gas estimated')) ok('Con CELO suficiente el formulario se mantiene ("Enough gas estimated")')
  else { console.log(`  Modal text: ${okText.slice(0, 160)}`); fail('Formulario esperado con CELO suficiente') }
  await closeModal(page)

  // ════════════════════════════════════════════════════════════════
  // Step 1b: CELO suficiente + eth_getBalance RETARDADO (regresión de la
  // carrera de gas, bug 2026-08-31). Antes del fix, la estimación corría con
  // celoBalance=0 (saldo aún sin cargar) y un fallo RPC transitorio de forno
  // clasificaba "no-gas" → el panel reemplazaba el formulario pese a tener
  // 1 CELO. Ahora el hook espera a balanceLoaded → sin falso panel.
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 1b: CELO suficiente con getBalance lento → el formulario NO se reemplaza ──')
  if (!await navAndWait(page, `${base}/en/gdcluster/ranking`, timeout)) {
    fail('Ranking page did not load'); await browser.close(); process.exit(1)
  }
  await new Promise(r => setTimeout(r, 4000))
  // 1 CELO (0xde0b6b3a7640000) con 1.5s de latencia simulada; 21000 gas a 0.5 gwei
  await patchGasProvider(page, {
    balance: '0xde0b6b3a7640000', balanceDelayMs: 1500,
    estimateGas: '0x5208', gasPrice: '0x1dcd6500',
  })
  if (!await clickDonateRow(page, 'en')) {
    fail('Donar button not found / modal not open'); await browser.close(); process.exit(1)
  }
  if (!await fillUsdtAmount(page, 1)) {
    fail('Amount input not found'); await browser.close(); process.exit(1)
  }
  const regText = await waitModalText(page, [
    'Enough gas estimated', 'CELO is needed to complete this transaction',
  ])
  if (regText.includes('Enough gas estimated') && !regText.includes('CELO is needed to complete this transaction')) {
    ok('Con saldo suficiente y RPC lento el formulario se mantiene (sin falso panel)')
  } else { console.log(`  Modal text: ${regText.slice(0, 200)}`); fail('Falso panel de gas con saldo suficiente (carrera)') }
  await closeModal(page)

  // ════════════════════════════════════════════════════════════════
  // Step 2: Ranking /en + parche → sin CELO → panel (EN, al abrir)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 2: Ranking /en — sin CELO → panel (EN) ──')
  if (!await navAndWait(page, `${base}/en/gdcluster/ranking`, timeout)) {
    fail('Ranking page did not load'); await browser.close(); process.exit(1)
  }
  await new Promise(r => setTimeout(r, 4000))
  await patchCeloBalance(page, CELO_LOW)
  if (!await clickDonateRow(page, 'en')) {
    fail('Donar button not found / modal not open'); await browser.close(); process.exit(1)
  }
  // Con CELO ≈ 0 el panel aparece de inmediato al abrir (sin monto)
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
  if (courseLink === '/en/web3-and-ubi/guide3') ok(`Enlace a la guía de reclamar CELO correcto: ${courseLink}`)
  else { console.log(`  Link: ${courseLink}`); fail('Enlace a la guía de reclamar CELO incorrecto') }
  if (await closeModal(page)) ok('Cerrar cierra el panel/modal')
  else fail('El modal no se cerró con Cerrar')

  // ════════════════════════════════════════════════════════════════
  // Step 3: Ranking /es — panel en español (página fresca)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Step 3: Ranking /es — panel en español ──')
  await new Promise(r => setTimeout(r, 4000))
  const esPage = await browser.newPage()
  await setupE2EAuth(esPage, creds.addr, creds.pk, CHAIN_ID, base)
  if (!await navAndWait(esPage, `${base}/es/gdcluster/ranking`, timeout)) {
    fail('Ranking page did not load'); await browser.close(); process.exit(1)
  }
  await new Promise(r => setTimeout(r, 4000))
  await patchCeloBalance(esPage, CELO_LOW)
  if (!await clickDonateRow(esPage, 'es')) {
    fail('Donar button not found / modal not open'); await browser.close(); process.exit(1)
  }
  const esText = await modalText(esPage)
  if (esText.includes('Se necesita CELO para completar esta transacción')) {
    ok('Panel mostrado en español')
  } else { console.log(`  Modal text: ${esText.slice(0, 200)}`); fail('Panel CELO no apareció (ES)') }
  const esLink = await esPage.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find(x => (x.textContent || '').includes('curso Web3 & UBI'))
    return a ? a.getAttribute('href') : null
  })
  if (esLink === '/es/web3-e-ibu/guia3') ok(`Enlace español a la guía de reclamar CELO correcto: ${esLink}`)
  else { console.log(`  Link: ${esLink}`); fail('Enlace español incorrecto') }
  await esPage.close()

  await browser.close()
  const failures = summary(t0); process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
