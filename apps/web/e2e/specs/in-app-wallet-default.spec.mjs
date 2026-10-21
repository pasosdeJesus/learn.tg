#!/usr/bin/env node
// E2E: la billetera de la aplicación es la opción por defecto (R-#270 §3.1/§3.2).
//
// Comprueba en el navegador, contra el sitio desplegado:
//   1. sin proveedor inyectado        → la in-app es el único camino
//   2. con proveedor de una extensión (`isMetaMask`) en un navegador común → la in-app
//      es la principal, la externa es secundaria y se ofrece importar la frase
//   3. navegador de una billetera     → la externa es la principal, la in-app es
//      secundaria con el aviso de que ahí no hay huella (y `?iappwallet=1` la fuerza)
//   4. importar la mnemónica conocida  → la misma dirección (ruta BIP44 estándar)
//
// Ojo con la inyección: `page.evaluateOnNewDocument` recibe **código como cadena**
// (con `new Function` no se ejecuta y la página ve el entorno del harness).
//
// La comprobación 4 registra un usuario nuevo en el sitio (es lo que hace cualquier
// importación real) y tolera los 401/400 que el sitio devuelve para ese usuario recién
// creado. Si falta la interfaz nueva, el spec OMITE en vez de fallar.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     node e2e/specs/in-app-wallet-default.spec.mjs

import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary, short,
} from '@pasosdejesus/m/e2e'
import { chooseWalletProtection } from '../helpers/in-app-wallet.mjs'

const PASSWORD = '12345678'
// Cuenta #1 de la mnemónica de Hardhat: la ruta BIP44 estándar (m/44'/60'/0'/0/0).
const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk'
const HARDHAT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
// La interfaz acorta la dirección con el carácter `…` (no con tres puntos ASCII).
const HARDHAT_SHORT = `0x${HARDHAT_ADDRESS.slice(2, 6)}…${HARDHAT_ADDRESS.slice(-4)}`.toLowerCase()
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const WALLET_BROWSER_UA = `${DESKTOP_UA} MetaMask/7.0`

// Proveedor de una **extensión** en un navegador común. `isMetaMask` la ponen por
// compatibilidad (Brave y Rabby también), así que no debe bastar para clasificar el
// navegador como el de una billetera (R-#270 §11.1/§11.3).
const INJECTED_PROVIDER = 'window.ethereum = { isMetaMask: true, request: async () => [], on: () => {}, removeListener: () => {} };'
const NO_PROVIDER = 'delete window.ethereum;'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const SELECTORS = () => ({
  inAppPrimary: !!document.querySelector('[data-testid="wallet-selector"]'),
  // R-#265 §3.9: `externalPrimary` ya no cambia la cabecera (un solo botón); ordena
  // las opciones dentro del modal y se publica como atributo.
  externalPrimary:
    document.querySelector('[data-testid="wallet-selector"]')?.getAttribute('data-external-primary') === 'true',
  openDialog: !!document.querySelector('[data-testid="wallet-open-dialog"]'),
})

/** Abre una página con la UA y el proveedor que pida el caso y espera a que pinte. */
async function openCase(browser, env, base, { ua, inject, path = '/en', cleanWallet = false }) {
  const page = await newPage(browser, undefined, env.timeout)
  await page.setUserAgent(ua)
  if (cleanWallet) {
    await page.evaluateOnNewDocument(
      "try { localStorage.clear(); indexedDB.deleteDatabase('learn-tg-pdj-wallet') } catch (e) {}",
    )
  }
  await page.evaluateOnNewDocument(inject)
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: env.timeout })
  for (let attempt = 0; attempt < 20; attempt++) {
    const state = await page.evaluate(SELECTORS)
    if (state.inAppPrimary || state.externalPrimary) break
    await sleep(1000)
  }
  // El HTML llega del servidor sin proveedor (`getServerSnapshot`); el estado real lo
  // fija la hidratación, así que hay que darle un momento antes de leer el DOM.
  await sleep(2500)
  return { page, state: await page.evaluate(SELECTORS) }
}

/** Abre el diálogo de la billetera reintentando: el primer clic puede caer antes de
 *  que React hidrate el botón. */
async function openWalletDialog(page) {
  for (let attempt = 0; attempt < 15; attempt++) {
    // R-#265 §3.9: sin sesión el header muestra `WalletConnect`; la acción in-app
    // vive dentro de su modal de elección.
    if (!(await page.$('[data-testid="wallet-open-dialog"]'))) {
      await page.click('[data-testid="connect-wallet"]').catch(() => {})
      await sleep(700)
    }
    await page.click('[data-testid="wallet-open-dialog"]').catch(() => {})
    const opened = await page
      .waitForSelector('[data-testid="wallet-mode-import"]', { timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    if (opened) return true
  }
  return false
}

/**
 * R-#265 §3.9: la elección in-app/externa vive en el modal del motor `WalletConnect`.
 * Lo abre y lee qué ofrece; `null` cuando la cabecera todavía no montó el botón.
 */
async function inspectChoice(page) {
  const trigger = await page.$('[data-testid="connect-wallet"]')
  if (!trigger) return null
  await trigger.click().catch(() => {})
  // El primer modal abre chunks perezosos (Radix, el motor) y el cuerpo espera a que
  // resuelvan la billetera de la aplicación y la sesión (`booting`): con el modal ya
  // abierto puede mostrar "loading" un instante. Se insiste en el disparador (el primer
  // clic puede caer antes de la hidratación) y se espera la acción in-app del cuerpo.
  let open = false
  for (let i = 0; i < 20; i++) {
    open = await page
      .evaluate(() => !!document.querySelector('[role="dialog"]'))
      .catch(() => false)
    if (open) {
      const body = await page
        .evaluate(() => !!document.querySelector('[role="dialog"] [data-testid="wallet-open-dialog"]'))
        .catch(() => false)
      if (body) break
    } else {
      await page.click('[data-testid="connect-wallet"]').catch(() => {})
    }
    await sleep(500)
  }
  return page
    .evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      const buttons = dialog ? [...dialog.querySelectorAll('button')] : []
      return {
        open: !!dialog,
        openDialog: !!dialog?.querySelector('[data-testid="wallet-open-dialog"]'),
        importHint: !!dialog?.querySelector('[data-testid="wallet-import-hint"]'),
        browserNote: !!dialog?.querySelector('[data-testid="wallet-browser-note"]'),
        external: buttons.some((button) =>
          /connect wallet|conectar billetera/i.test(button.textContent || ''),
        ),
      }
    })
    .catch(() => null)
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const base = process.env.SITE_URL || env.base
  const browser = await launchBrowser(env.headless)

  // 1. Sin proveedor inyectado: el único camino es la billetera de la aplicación.
  const { page: noProvider, state: s1 } = await openCase(browser, env, base, { ua: DESKTOP_UA, inject: NO_PROVIDER })
  if (!s1.inAppPrimary && !s1.externalPrimary) {
    console.log('[SKIP] el sitio no expone la interfaz de billetera (¿rama sin desplegar?)')
    await browser.close()
    process.exit(0)
  }
  console.log(`Billetera in-app por defecto | ${base}\n`)

  if (s1.inAppPrimary) {
    const c1 = await inspectChoice(noProvider)
    if (c1?.openDialog) ok('sin proveedor: se ofrece la billetera de la aplicación')
    else fail(`sin proveedor: no se ofrece la billetera de la aplicación (${JSON.stringify({ s1, c1 })})`)
    if (c1?.external) fail('sin proveedor NO debería ofrecerse la billetera externa')
    else ok('sin proveedor: la externa no se ofrece')
  } else {
    fail(`sin proveedor: no se ofrece la billetera de la aplicación (${JSON.stringify(s1)})`)
  }
  await noProvider.close()

  // 2. Proveedor de una extensión en un navegador común: la in-app sigue siendo la
  //    principal (la marca del navegador propio de la billetera está en el UA, no en
  //    `isMetaMask`; R-#270 §11.1).
  const { page: withInjected, state: s2 } = await openCase(browser, env, base, { ua: DESKTOP_UA, inject: INJECTED_PROVIDER })
  const c2 = await inspectChoice(withInjected)
  if (s2.inAppPrimary && c2?.external) ok('con proveedor (extensión en un navegador común): la in-app es la principal y la externa es secundaria')
  else fail(`con proveedor (extensión en un navegador común): prioridad inesperada (${JSON.stringify({ s2, c2 })})`)
  if (c2?.importHint) ok('se ofrece importar la frase para conservar la dirección')
  else fail('no se ofrece importar la frase con un proveedor a la vista')
  await withInjected.close()

  // 3. Navegador propio de una billetera (la marca va en el UA): la externa va primero
  //    en el modal, con la in-app como alternativa.
  const { page: walletBrowser, state: s3 } = await openCase(browser, env, base, { ua: WALLET_BROWSER_UA, inject: INJECTED_PROVIDER })
  const c3 = await inspectChoice(walletBrowser)
  if (s3.externalPrimary && c3?.external && c3?.openDialog) ok('en el navegador de una billetera: la externa va primero y la in-app queda alternativa')
  else fail(`en el navegador de una billetera: prioridad inesperada (${JSON.stringify({ s3, c3 })})`)
  if (c3?.browserNote) ok('se avisa que ahí no hay huella ni Face ID')
  else fail('falta el aviso de WebAuthn/L1 en el navegador de una billetera')
  await walletBrowser.close()

  // 3b. `?iappwallet=1` fuerza la in-app incluso ahí.
  const { page: forced, state: s4 } = await openCase(browser, env, base, {
    ua: WALLET_BROWSER_UA, inject: INJECTED_PROVIDER, path: '/en?iappwallet=1',
  })
  if (s4.inAppPrimary) {
    const c4 = await inspectChoice(forced)
    if (c4?.openDialog) ok('`?iappwallet=1` fuerza la billetera de la aplicación')
    else fail(`\`?iappwallet=1\` no forzó la billetera de la aplicación (${JSON.stringify({ s4, c4 })})`)
  } else {
    fail(`\`?iappwallet=1\` no forzó la billetera de la aplicación (${JSON.stringify(s4)})`)
  }
  await forced.close()

  // 4. Importar una mnemónica conocida conserva la dirección (ruta BIP44 estándar).
  //    En un navegador aparte: los casos anteriores comparten el perfil y una billetera
  //    ya creada dejaría el diálogo sin el formulario de importar.
  const importBrowser = await launchBrowser(env.headless)
  const { page: importPage } = await openCase(importBrowser, env, base, {
    ua: DESKTOP_UA, inject: NO_PROVIDER, path: '/en?iappwallet=1',
    cleanWallet: true,
  })
  if (!(await openWalletDialog(importPage))) {
    fail('no se pudo abrir el diálogo de la billetera para importar')
  } else {
    await importPage.click('[data-testid="wallet-mode-import"]')
    await importPage.waitForSelector('[data-testid="wallet-mnemonic"]', { timeout: env.timeout })

  const dialog = await importPage.evaluate(() => {
    const importButton = document.querySelector('[data-testid="wallet-import"]')
    return {
      security: !!document.querySelector('[data-testid="wallet-import-security"]'),
      guide: document.querySelector('[data-testid="wallet-migration-guide"]')?.getAttribute('href') || null,
      privateKeyField: !!document.querySelector('[data-testid="wallet-private-key"]'),
      importDisabled: importButton ? importButton.disabled : null,
    }
  })
  if (dialog.security && dialog.guide === '/en/migration-in-app-wallet') ok('el diálogo explica que la frase no sale del dispositivo y enlaza la guía')
  else fail(`el diálogo de importación no trae el aviso o la guía (${JSON.stringify(dialog)})`)

  // R-#270 §13: también se puede importar la llave privada, y el botón no se habilita vacío.
  if (dialog.privateKeyField && dialog.importDisabled === true) ok('el diálogo ofrece importar con llave privada y no deja importar en vacío')
  else fail(`falta el campo de llave privada o el botón se habilita vacío (${JSON.stringify(dialog)})`)

  await importPage.type('[data-testid="wallet-mnemonic"]', HARDHAT_MNEMONIC)
  await importPage.type('[data-testid="wallet-password"]', PASSWORD)
  await importPage.click('[data-testid="wallet-import"]')
  await chooseWalletProtection(importPage)

  const expected = HARDHAT_SHORT
  let imported = false
  for (let attempt = 0; attempt < 30 && !imported; attempt++) {
    imported = await importPage.evaluate(
      (needle) => (document.body.textContent || '').toLowerCase().includes(needle),
      expected,
    )
    if (!imported) await sleep(1000)
  }
  if (imported) ok(`la dirección importada es la esperada: ${short(HARDHAT_ADDRESS)}`)
  else {
    const seen = await importPage.evaluate(() => (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 200))
    fail(`la dirección importada no coincide con ${short(HARDHAT_ADDRESS)} — pantalla: ${seen}`)
  }
  }
  await importPage.close()
  await importBrowser.close()

  await browser.close()

  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
