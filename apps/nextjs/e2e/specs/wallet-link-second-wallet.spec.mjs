#!/usr/bin/env node
// E2E: vincular una **segunda** billetera a la cuenta (R-#265 §3.2).
//
// Escenario reportado por el operador (2026-10-16) en Chrome de escritorio: se ingresa
// con la billetera de la aplicación, se activa una billetera del navegador (OneKey) y al
// pulsar "Vincular otra billetera" el aviso decía que la billetera ya estaba en la cuenta.
// Causa: la extensión existía pero el sitio todavía no tenía su permiso (`eth_accounts`
// devuelve `[]` hasta que el usuario lo concede con `eth_requestAccounts`), así que el
// código sólo veía la billetera de la aplicación —igual a la de la sesión— y se comparaba
// consigo misma.
//
// Este spec reproduce ese estado exacto (cuentas vacías hasta `eth_requestAccounts`) y
// exige que la externa quede **vinculada** a la misma cuenta.
//
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/wallet-link-second-wallet.spec.mjs
//
// Contra un servidor local: SITE_URL=http://localhost:4000 …

import {
  initTestEnv, launchBrowser, resetFailures, fail, ok, summary, setupFullWalletMock,
} from '@pasosdejesus/m/e2e'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { chooseWalletProtection } from '../helpers/in-app-wallet.mjs'

const password = '12345678'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function exists(page, selector) {
  try {
    return !!(await page.$(selector))
  } catch {
    return false
  }
}

/** El click se pierde si la página aún no hidrató: insistir hasta que abra. */
async function openDialog(page) {
  for (let i = 0; i < 25; i++) {
    // R-#265 §3.9: sin sesión el header muestra `WalletConnect`; la acción in-app
    // vive dentro de su modal de elección.
    if (!(await exists(page, '[data-testid="wallet-open-dialog"]'))) {
      await page.click('[data-testid="connect-wallet"]').catch(() => {})
      await sleep(700)
    }
    await page.click('[data-testid="wallet-open-dialog"]').catch(() => {})
    await sleep(700)
    if (await exists(page, '[data-testid="wallet-dialog"]')) return true
  }
  return false
}

async function header(page) {
  return page
    .evaluate(() => {
      const inApp = document.querySelector('[data-testid="wallet-selector-in-app"]')
      return { signedIn: (inApp?.innerText || '').replace(/\s+/g, ' ').trim() || null }
    })
    .catch(() => ({ signedIn: null }))
}

/** Deja una sesión firmada con la billetera de la aplicación (crea si no existe). */
async function ensureInAppSession(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await header(page)).signedIn) return true
    await page
      .waitForSelector('[data-testid="wallet-selector"], [data-testid="wallet-selector-in-app"]', { timeout: 90000 })
      .catch(() => {})
    await sleep(2500)
    if (!(await openDialog(page))) {
      await sleep(2000)
      continue
    }

    // ¿Formulario de creación (password + confirmación)? Si no, es el desbloqueo.
    const createForm = await page
      .waitForSelector('[data-testid="wallet-password-confirm"]', { timeout: 8000 })
      .catch(() => null)
    if (createForm) {
      await page.type('[data-testid="wallet-password"]', password)
      await page.type('[data-testid="wallet-password-confirm"]', password)
      await page.click('[data-testid="wallet-create"]')
      await chooseWalletProtection(page)
      await page.waitForSelector('[data-testid="wallet-recovery-words"]', { timeout: 60000 }).catch(() => {})
      ok('Billetera de la aplicación creada')
      await page.keyboard.press('Escape')
      await sleep(1500)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await sleep(4000)
      continue
    }

    const unlockForm = await page
      .waitForSelector('[data-testid="wallet-password"]', { timeout: 15000 })
      .catch(() => null)
    if (unlockForm && (await exists(page, '[data-testid="wallet-unlock"]'))) {
      await page.type('[data-testid="wallet-password"]', password)
      await page.click('[data-testid="wallet-unlock"]').catch(() => {})
      for (let i = 0; i < 25; i++) {
        await sleep(1500)
        if ((await header(page)).signedIn) break
      }
    } else {
      await page.keyboard.press('Escape')
      await sleep(1000)
    }
  }
  return !!(await header(page)).signedIn
}

/** Billeteras de la cuenta de la sesión (`GET /api/wallet`, motor `wallet`). */
async function accountWallets(page) {
  return page
    .evaluate(async () => {
      const session = await fetch('/api/auth/session').then((r) => r.json()).catch(() => null)
      const address = session?.address || ''
      const res = await fetch(`/api/wallet?walletAddress=${encodeURIComponent(address)}`)
      if (!res.ok) return { status: res.status, wallets: null }
      const body = await res.json()
      return {
        status: res.status,
        wallets: (body?.wallets ?? []).map((wallet) => String(wallet.billetera).toLowerCase()),
      }
    })
    .catch((error) => ({ status: 0, wallets: null, error: String(error) }))
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { chainId } = env
  // `initTestEnv` siempre construye https://; un servidor local (`next dev -p 4000`)
  // sirve HTTP, así que se puede apuntar con SITE_URL.
  const base = process.env.SITE_URL || env.base

  // Billetera externa con clave nueva (el sitio nunca la vio) y firma **real**.
  const externalPk = generatePrivateKey()
  const externalAddress = privateKeyToAccount(externalPk).address

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(180000)

  console.log(`Vincular una segunda billetera | ${base}`)
  console.log(`  externa: ${externalAddress}\n`)

  await setupFullWalletMock(page, { privateKey: externalPk, address: externalAddress, chainId })

  // ── 1. Ingresar con la billetera de la aplicación ──────────────────────────
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  if (!(await ensureInAppSession(page))) {
    fail('No se consiguió una sesión con la billetera de la aplicación')
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }
  ok(`Sesión con la billetera de la aplicación: "${(await header(page)).signedIn}"`)

  // R-#265 (2026-10-17): vincular vive en la sección de billeteras del perfil (y en la
  // pestaña "Cuentas" del panel). El perfil no exige desbloquear la billetera, así que
  // es el camino estable para el E2E.
  await page.goto(`${base}/en/profile`, { waitUntil: 'domcontentloaded' })
  for (let i = 0; i < 45; i++) {
    if (await exists(page, '[data-testid="account-wallet-actions"]')) break
    await sleep(1000)
  }

  // ── 2. Estado del reporte: la extensión existe pero SIN permiso del sitio ──
  await page.evaluate(() => {
    const provider = window.ethereum
    if (!provider || provider.__e2eAccountsGated) return
    provider.__e2eAccountsGated = true
    const original = provider.request.bind(provider)
    let granted = false
    provider.request = (args) => {
      if (args?.method === 'eth_requestAccounts') granted = true
      if (args?.method === 'eth_accounts') return Promise.resolve(granted ? original(args) : [])
      return original(args)
    }
  })

  const before = await accountWallets(page)
  if (before.status === 200 && before.wallets?.length === 1) {
    ok('La cuenta empieza con 1 billetera (la de la aplicación)')
  } else {
    fail(`Antes de vincular, GET /api/wallet = ${JSON.stringify(before)}`)
  }

  // ── 3. Vincular: debe firmar la externa (y pedirle permiso primero) ────────
  if (!(await exists(page, '[data-testid="wallet-link"]'))) {
    fail('El perfil no ofrece "Vincular otra billetera" con la sesión abierta')
  } else {
    await page.click('[data-testid="wallet-link"]').catch(() => {})
    let message = ''
    for (let i = 0; i < 30; i++) {
      await sleep(1000)
      message = await page
        .$eval('[data-testid="wallet-link-message"]', (el) => el.innerText)
        .catch(() => '')
      if (/linked|vinculada/i.test(message)) break
      if (/already in your account|ya est[aá] en tu cuenta/i.test(message)) break
      if (/connect an external|conecta una externa|conecta una billetera externa/i.test(message)) break
    }
    const ignoredExternal =
      /already in your account|ya est[aá] en tu cuenta/i.test(message) ||
      /connect an external|conecta una externa|conecta una billetera externa/i.test(message)
    if (ignoredExternal) {
      fail(`No se pudo vincular la externa: "${message}" (no se le pidió permiso con eth_requestAccounts)`)
    } else if (!/linked|vinculada/i.test(message)) {
      fail(`Mensaje inesperado al vincular: "${message}"`)
    } else {
      ok(`La billetera externa se vinculó: "${message}"`)
    }
  }

  // ── 4. La cuenta ahora tiene las dos ──────────────────────────────────────
  await sleep(1500)
  const after = await accountWallets(page)
  const external = externalAddress.toLowerCase()
  if (after.status === 200 && after.wallets?.includes(external) && after.wallets.length === 2) {
    ok(`La cuenta quedó con 2 billeteras e incluye la externa (${external.slice(0, 10)}…)`)
  } else {
    fail(`Tras vincular, GET /api/wallet = ${JSON.stringify(after)}`)
  }

  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
