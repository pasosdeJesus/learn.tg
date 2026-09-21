#!/usr/bin/env node
// Reproduce the bugs the operator found by hand on the dev site (2026-09-19) with
// the in-app wallet:
//
//  A/B. The donation/purchase modals showed the three balances as ZERO and did not
//       let the user donate, with this in the console:
//       "Unsupported method: eth_call". The in-app EIP-1193 provider only answered
//       the signing methods, so every read the pages do fell through.
//  C1.  The modals asked to unlock even when the wallet had just been unlocked and
//       the application had stayed open.
//  C2.  With a passkey enrolled, the modal asked the user to press "unlock" and
//       only then for the fingerprint; the gesture must be asked directly.
//  D.   In a wallet browser (OKX/Rabby/MetaMask) the in-app wallet must not be
//       offered unless the URL says `?iappwallet=1`.
//  E.   Right after unlocking with the fingerprint, pressing the pill showed the
//       create-wallet form instead of the wallet.
//
// Run: CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=in-app-wallet-payments
import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, newIncognitoContext,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { completeBackupVerification } from '../helpers/in-app-wallet.mjs'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const password = '12345678'
const USDT_DECIMALS = 6

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
      return {
        pk,
        addr: g('NEXT_PUBLIC_ADDRESS'),
        usdt: g('NEXT_PUBLIC_USDT_ADDRESS'),
        slearn: g('NEXT_PUBLIC_SLEARN_ADDRESS'),
        rpc: g('NEXT_PUBLIC_RPC_URL'),
      }
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

async function text(page, selector) {
  try {
    return await page.$eval(selector, (el) => el.textContent || '')
  } catch {
    return ''
  }
}

async function bodyText(page) {
  try {
    return await page.evaluate(() => {
      const overlay = document.querySelector('.fixed.inset-0')
      return overlay ? overlay.innerText || '' : document.body?.innerText || ''
    })
  } catch {
    return ''
  }
}

async function openDialog(page) {
  for (let i = 0; i < 25; i++) {
    await page.click('[data-testid="wallet-open-dialog"]').catch(() => {})
    await sleep(700)
    if (await exists(page, '[data-testid="wallet-dialog"]')) return true
    // R-#249: con la billetera desbloqueada la píldora abre el PANEL, no el diálogo.
    if (await exists(page, '[data-testid="wallet-panel"]')) return true
  }
  return false
}

async function closeDialog(page) {
  await page.keyboard.press('Escape')
  for (let i = 0; i < 10; i++) {
    await sleep(400)
    if (!(await exists(page, '[data-testid="wallet-dialog"]'))) return true
  }
  return false
}


/** Cierra el modal de donación/compra (Escape o su ✕) y confirma que no hay overlay. */
async function closePayModal(page) {
  for (let i = 0; i < 6; i++) {
    const closed = await page.evaluate(() => {
      const overlay = document.querySelector('.fixed.inset-0')
      if (!overlay) return true
      const close = [...overlay.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '✕')
      if (close) { close.click(); return false }
      return false
    }).catch(() => true)
    if (closed) return true
    await page.keyboard.press('Escape')
    await sleep(1200)
    const gone = await page.evaluate(() => !document.querySelector('.fixed.inset-0')).catch(() => true)
    if (gone) return true
  }
  return !(await page.evaluate(() => !!document.querySelector('.fixed.inset-0')).catch(() => false))
}

async function headerSignedIn(page) {
  return !!(await exists(page, '[data-testid="wallet-selector-in-app"]'))
}

/** Crea la billetera de la aplicación desde la cabecera y firma. */
async function createInAppWallet(page, base) {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await sleep(6000)
  if (await headerSignedIn(page)) return true
  if (!(await openDialog(page))) return false
  const createForm = await page
    .waitForSelector('[data-testid="wallet-password-confirm"]', { timeout: 30000 })
    .catch(() => null)
  if (!createForm) {
    await closeDialog(page)
    return false
  }
  await page.type('[data-testid="wallet-password"]', password)
  await page.type('[data-testid="wallet-password-confirm"]', password)
  await page.click('[data-testid="wallet-create"]')
  await page.waitForSelector('[data-testid="wallet-recovery-words"]', { timeout: 90000 })
  await completeBackupVerification(page)
  for (let i = 0; i < 30; i++) {
    await sleep(1500)
    if (await headerSignedIn(page)) return true
  }
  return false
}

/** Dirección completa: del registro en IndexedDB (la cabecera la abrevia). */
async function walletAddress(page) {
  try {
    return await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const open = indexedDB.open('learn-tg-pdj-wallet')
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      if (!db.objectStoreNames.contains('wallet')) return null
      const record = await new Promise((resolve) => {
        const req = db.transaction('wallet', 'readonly').objectStore('wallet').get('current')
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => resolve(null)
      })
      return record?.address || null
    })
  } catch {
    return null
  }
}

/** Transfiere CELO/USDT/SLEARN desde la billetera de apps/.env a `to`. */
async function fundFromTestWallet(envFiles, to) {
  const { privateKeyToAccount } = await import('viem/accounts')
  const { createPublicClient, createWalletClient, http, parseEther } = await import('viem')
  const { celoSepolia } = await import('viem/chains')
  const account = privateKeyToAccount(envFiles.pk)
  const rpc = envFiles.rpc || 'https://forno.celo-sepolia.celo-testnet.org'
  const publicClient = createPublicClient({ chain: celoSepolia, transport: http(rpc) })
  const wallet = createWalletClient({ account, chain: celoSepolia, transport: http(rpc) })
  const erc20 = [{
    name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  }]
  const hashes = []
  // Secuencial y esperando cada recibo: dos transferencias seguidas hacen que el
  // nodo devuelva un nonce rezagado ("Nonce ... is lower than the current nonce").
  hashes.push(await wallet.sendTransaction({ to, value: parseEther('0.5') }))
  await publicClient.waitForTransactionReceipt({ hash: hashes[0], timeout: 120000 }).catch(() => null)
  if (envFiles.usdt) {
    hashes.push(await wallet.writeContract({
      address: envFiles.usdt, abi: erc20, functionName: 'transfer',
      args: [to, BigInt(1 * 10 ** USDT_DECIMALS)],
    }))
  }
  for (const h of hashes) {
    await publicClient.waitForTransactionReceipt({ hash: h, timeout: 120000 }).catch(() => null)
  }
  return hashes.length
}

/** Abre el modal de donación de un curso. */
async function openDonateModal(page, base) {
  const routes = ['/en/a-relationship-with-Jesus', '/en/gdcluster', '/en']
  for (const route of routes) {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForSelector('button', { timeout: 90000 }).catch(() => {})
    await sleep(3000)
    let clicked = false
    for (let i = 0; i < 20 && !clicked; i++) {
      await sleep(1500)
      clicked = await page.evaluate(() => {
        const label = /Donate to this course|Donar a este curso|Donate now|Donar ahora|Buy this course|Comprar este curso/i
        const button = [...document.querySelectorAll('button')].find((b) => label.test((b.innerText || '').trim()))
        if (!button) return false
        button.scrollIntoView({ block: 'center' })
        button.click()
        return true
      }).catch(() => false)
    }
    if (!clicked) {
      const labels = await page
        .$$eval('button', (els) => els.map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 15))
        .catch(() => [])
      console.log(`  [diag] ${route}: sin botón de donación/compra. Botones: ${JSON.stringify(labels)}`)
      continue
    }
    for (let i = 0; i < 20; i++) {
      await sleep(1000)
      if (await exists(page, '[data-testid="wallet-unlock-request"]')) return true
      const body = await bodyText(page)
      if (/Balance|Saldo/i.test(body) && /Donate|Donar|Purchase|Comprar/i.test(body)) return true
    }
    return true
  }
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnv()
  if (!creds) {
    console.error('No credentials found in apps/.env')
    process.exit(1)
  }
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const base = process.env.SITE_URL || env.base
  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(180000)

  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  console.log(`Pagos con la billetera de la aplicación | ${base}\n`)

  // Authenticator virtual con PRF: en el teléfono es Face ID / huella.
  const cdp = await page.createCDPSession()
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
      hasPrf: true,
    },
  }).catch((e) => {
    fail(`Chrome sin authenticator virtual con PRF: ${String(e).slice(0, 120)}`)
    return { authenticatorId: null }
  })

  // ── 1. Billetera de la aplicación, con fondos reales ──────────────────────
  if (!(await createInAppWallet(page, base))) {
    fail('No se pudo crear/ingresar con la billetera de la aplicación')
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }
  const inApp = await walletAddress(page)
  if (!inApp) {
    fail('No se pudo leer la dirección de la billetera de la aplicación')
  } else {
    ok(`Billetera de la aplicación: ${inApp.slice(0, 8)}…`)
  }
  await closeDialog(page)

  if (inApp) {
    try {
      const n = await fundFromTestWallet(creds, inApp)
      ok(`Fondos transferidos (${n} tx) a la billetera de la aplicación`)
      await sleep(4000)
    } catch (e) {
      console.log(`  [!] No se pudo fondear (${String(e?.shortMessage || e.message).slice(0, 90)}): se omite el saldo`)
    }
  }

  // ── 2. Bug A/B: el modal de donación debe leer saldos y dejar donar ───────
  // La creación + SIWE recargan la página y la clave sale de memoria: se
  // desbloquea primero, que es lo que hace el usuario antes de donar.
  if (await openDialog(page)) {
    for (let i = 0; i < 20; i++) {
      if (await exists(page, '[data-testid="wallet-unlock"]')) break
      await sleep(1000)
    }
    if (await exists(page, '[data-testid="wallet-unlock"]')) {
      await page.type('[data-testid="wallet-password"]', password)
      await page.click('[data-testid="wallet-unlock"]')
      for (let i = 0; i < 25; i++) {
        await sleep(1000)
        if (!(await exists(page, '[data-testid="wallet-dialog"]'))) break
      }
    }
    await closeDialog(page)
    await sleep(1000)
  }

  if (!(await openDonateModal(page, base))) {
    fail('No se encontró un botón de donación para abrir el modal')
  } else {
    const modalText = await bodyText(page)
    const unsupported = consoleErrors.filter((e) => /Unsupported method/i.test(e))
    if (unsupported.length) {
      fail(`El provider de la billetera no responde lecturas: ${unsupported[0].slice(0, 90)}`)
    } else {
      ok('Sin errores "Unsupported method" en la consola')
    }

    const usdtMatches = [...modalText.matchAll(/(?:USDT Balance|saldo USDT)[^0-9]{0,12}([0-9][0-9.,]*)/gi)]
    const usdtShown = usdtMatches.length ? Number(usdtMatches[0][1].replace(',', '.')) : null
    if (usdtShown === null || usdtShown === 0) {
      console.log(`  [diag] texto del modal: ${modalText.replace(/\s+/g, ' ').slice(0, 240)}`)
    }
    if (usdtShown === null) {
      fail('El modal no muestra el saldo USDT')
    } else if (usdtShown > 0) {
      ok(`El modal muestra el saldo USDT real: ${usdtShown}`)
    } else {
      fail(`El modal muestra USDT en cero con fondos en la billetera (bug del provider de lecturas)`)
    }

    // Con saldo, el botón debe habilitarse al escribir un monto.
    const amountInput = await page.$('input[type="number"]')
    if (amountInput) {
      await amountInput.click()
      await amountInput.type('0.1')
      await sleep(2500)
      const canDonate = await page.evaluate(() => {
        const label = /^Donate$|^Donar$|Donate |Donar /i
        const b = [...document.querySelectorAll('button')].find((x) => label.test((x.innerText || '').trim()))
        return b ? !b.disabled : null
      }).catch(() => null)
      if (canDonate === true) ok('El botón de donar se habilita con saldo y monto')
      else if (canDonate === false) fail('El botón de donar sigue deshabilitado con saldo y monto (bug reportado)')
      else console.log('  [!] No se encontró el botón de donar para verificar')
    } else {
      console.log('  [!] El modal no mostró campo de monto')
    }

    // ── 3. Bug C1: si la billetera se desbloqueó y la aplicación sigue abierta, el
    //        modal no debe pedir desbloqueo. Crear+SIVE recarga la página (la clave
    //        sale de memoria), así que se desbloquea de nuevo sin recargar.
    await closePayModal(page)
    let unlocked = false
    if (await openDialog(page)) {
      for (let i = 0; i < 20; i++) {
        if (await exists(page, '[data-testid="wallet-unlock"]')) break
        await sleep(1000)
      }
      if (await exists(page, '[data-testid="wallet-unlock"]')) {
        await page.type('[data-testid="wallet-password"]', password)
        await page.click('[data-testid="wallet-unlock"]')
        for (let i = 0; i < 25; i++) {
          await sleep(1000)
          if (!(await exists(page, '[data-testid="wallet-dialog"]'))) { unlocked = true; break }
        }
      }
      await closeDialog(page)
    }
    if (!unlocked) {
      console.log('  [!] No se pudo desbloquear sin recargar: se omite C1')
    } else {
      let reopened = false
      for (let i = 0; i < 20 && !reopened; i++) {
        reopened = await page.evaluate(() => {
          const label = /Donate to this course|Donar a este curso|Donate now|Donar ahora|Buy this course|Comprar este curso/i
          const button = [...document.querySelectorAll('button')].find((b) => label.test((b.innerText || '').trim()))
          if (!button) return false
          button.click()
          return true
        }).catch(() => false)
        if (!reopened) await sleep(1000)
      }
      await sleep(3000)
      if (!reopened) console.log('  [!] No se pudo reabrir el modal sin navegar: se omite C1')
      else if (await exists(page, '[data-testid="wallet-unlock-request"]')) {
        fail('El modal pide desbloquear con la billetera desbloqueada y la aplicación abierta (C1)')
      } else {
        ok('El modal no pide desbloqueo con la billetera desbloqueada y la app abierta (C1)')
      }
    }
  }

  // ── 4. R-#249: con la billetera desbloqueada la píldora abre el PANEL (saldos,
  //        recibir, enviar, coleccionables) y nunca el formulario de crear (bug E).
  await closePayModal(page)
  for (let i = 0; i < 20; i++) {
    const ready = await page
      .evaluate(() => (document.body?.innerText || '').length > 200)
      .catch(() => false)
    if (ready) break
    await sleep(1000)
  }
  if (await openDialog(page)) {
    for (let i = 0; i < 15; i++) {
      if (await exists(page, '[data-testid="wallet-panel"]')) break
      if (await exists(page, '[data-testid="wallet-address"]')) break
      if (await exists(page, '[data-testid="wallet-create"]')) break
      await sleep(1000)
    }
    const dialogText = await bodyText(page)
    const createUi =
      (await exists(page, '[data-testid="wallet-create"]')) ||
      (await exists(page, '[data-testid="wallet-password-confirm"]')) ||
      (await exists(page, '[data-testid="wallet-mode-create"]')) ||
      /Create a wallet|Crear una billetera/i.test(dialogText)
    const panelOpen = await exists(page, '[data-testid="wallet-panel"]')
    const walletUi = panelOpen || (await exists(page, '[data-testid="wallet-address"]'))

    if (createUi || !walletUi) {
      console.log(`  [diag] texto del diálogo: ${dialogText.replace(/\s+/g, ' ').slice(0, 200)}`)
      fail('La píldora mostró el formulario de crear billetera en vez de la billetera (E)')
    } else if (!panelOpen) {
      console.log('  [!] El panel (R-#249) no está en este build: la píldora abre el diálogo')
      ok('La píldora muestra la billetera y no el formulario de crear (E)')
    } else {
      ok('La píldora abre el panel de la billetera (R-#249)')

      // Saldos reales del panel (se fondeó 1 USDT a esta billetera).
      let usdtShown = null
      for (let i = 0; i < 15; i++) {
        // Ojo: `text` es la función lectora del spec; no reutilizar su nombre aquí.
        const balanceText = await text(page, '[data-testid="wallet-panel-balance-USDT"]')
        if (balanceText) { usdtShown = Number(balanceText.replace(',', '.')) ; break }
        await sleep(1000)
      }
      if (usdtShown !== null && usdtShown > 0) ok(`El panel muestra el saldo USDT real: ${usdtShown}`)
      else fail(`El panel muestra el saldo USDT como ${usdtShown ?? 'nada'}`)

      // Recibir: QR con la dirección (R-#254: vive en su pestaña).
      await page.click('[data-testid="wallet-panel-tab-receive"]').catch(() => {})
      await sleep(1200)
      if (await exists(page, '[data-testid="wallet-panel-qr"]')) ok('El panel muestra el QR para recibir')
      else fail('El panel no mostró el QR para recibir')

      // Copiar la dirección.
      await page.click('[data-testid="wallet-panel-copy"]').catch(() => {})
      await sleep(800)
      const copyText = await text(page, '[data-testid="wallet-panel-copy"]')
      if (/Copied|Copiada/i.test(copyText)) ok('Copiar la dirección confirma la copia')
      else console.log(`  [!] El botón de copiar quedó en "${copyText.trim()}"`)

      // Enviar: la validación rechaza una dirección inválida antes de firmar.
      // R-#254: el formulario vive en su pestaña.
      await page.click('[data-testid="wallet-panel-tab-send"]').catch(() => {})
      await sleep(600)
      await page.type('[data-testid="wallet-panel-to"]', 'no-es-direccion').catch(() => {})
      await page.type('[data-testid="wallet-panel-amount"]', '0.1').catch(() => {})
      await sleep(1500)
      const validation = await text(page, '[data-testid="wallet-panel-error"]')
      if (validation) ok('El panel valida la dirección destino antes de firmar')
      else fail('El panel no avisó de una dirección destino inválida')
      const sentDisabled = await page
        .$eval('[data-testid="wallet-panel-send"]', (el) => el.disabled)
        .catch(() => null)
      if (sentDisabled === true) ok('El botón de enviar queda deshabilitado con datos inválidos')
      else console.log('  [!] El botón de enviar no está deshabilitado con datos inválidos')
    }
    await closePayModal(page)
    await page.keyboard.press('Escape')
    await sleep(800)
  } else {
    fail('La cabecera no abrió la billetera')
  }

  // ── 5. Bug C2: con huella registrada, abrir el modal pide el gesto directo ─
  let enrolled = false
  if (await openDialog(page)) {
    for (let i = 0; i < 20; i++) {
      if (await exists(page, '[data-testid="wallet-enable-biometric"]')) break
      await sleep(1000)
    }
    if (await exists(page, '[data-testid="wallet-enable-biometric"]')) {
      // Con la billetera desbloqueada el password de la activación es `wallet-biometric-password`
      // (el formulario de crear, con `wallet-password`, ya no se muestra: bug E).
      const pinField = (await exists(page, '[data-testid="wallet-password"]'))
        ? '[data-testid="wallet-password"]'
        : '[data-testid="wallet-biometric-password"]'
      if (await exists(page, pinField.replace('[data-testid="', '[data-testid="'))) {
        await page.type(pinField, password)
      }
      await page.click('[data-testid="wallet-enable-biometric"]')
      for (let i = 0; i < 25; i++) {
        await sleep(1500)
        // Señal de éxito: el estado "desbloqueo con huella activado"; el diálogo
        // puede seguir abierto (activar no cierra ni firma).
        if (await exists(page, '[data-testid="wallet-biometric-status"]')) { enrolled = true; break }
        const err = await page
          .$eval('[data-testid="wallet-dialog-error"]', (el) => el.textContent || '')
          .catch(() => null)
        if (err) { console.log(`  [!] Activar huella falló: ${err}`); break }
      }
    }
    await closeDialog(page)
  }
  if (enrolled) {
    ok('Huella registrada (passkey + PRF)')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sleep(6000)
    if (await openDonateModal(page, base)) {
      // El gesto se completa en milisegundos (authenticator virtual), así que ver el
      // diálogo es una carrera: lo que importa es el resultado para el usuario, que
      // el aviso "desbloquear" desaparezca SIN pulsarlo.
      let askedDirectly = false
      let noticeStays = false
      for (let i = 0; i < 20; i++) {
        await sleep(1000)
        const dialog = await exists(page, '[data-testid="wallet-dialog"]')
        const notice = await exists(page, '[data-testid="wallet-unlock-request"]')
        if (dialog) askedDirectly = true
        if (!notice && !dialog) { askedDirectly = true; break }
        if (i >= 12 && notice) { noticeStays = true; break }
      }
      if (askedDirectly && !noticeStays) ok('Con huella, el modal pide el gesto directamente (C2)')
      else fail('El modal no pidió el gesto por sí solo: el usuario tiene que pulsar "desbloquear" (C2)')
      await closeDialog(page)
      await closePayModal(page)
    } else {
      console.log('  [!] Sin modal de donación para probar C2')
    }
  } else {
    console.log('  [!] No se pudo registrar la huella: se omite C2')
  }

  // ── 6. Bug D: en un navegador con billetera inyectada no se ofrece la de la
  //        aplicación, salvo con ?iappwallet=1.
  // Contexto de incógnito: el perfil de la corrida YA tiene una billetera in-app, y
  // con ella el selector la conserva por diseño (no se puede dejar inaccesible).
  const incognito = await newIncognitoContext(browser)
  const externalPage = await incognito.newPage()
  await externalPage.setDefaultNavigationTimeout(120000)
  await externalPage.evaluateOnNewDocument(() => {
    const provider = {
      isMetaMask: true,
      request: async () => null,
      on: () => {},
      removeListener: () => {},
    }
    window.ethereum = provider
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: Object.freeze({ info: { uuid: 't', name: 'OKX Wallet', rdns: 'com.okex.wallet', icon: '' }, provider }),
      }))
    })
  })
  await externalPage.goto(`${base}/en`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(5000)
  const externalOnly = await exists(externalPage, '[data-testid="wallet-selector-external"]')
  const inAppShown = await exists(externalPage, '[data-testid="wallet-open-dialog"]')
  if (externalOnly && !inAppShown) {
    ok('Con billetera inyectada solo se ofrece la externa (D)')
  } else {
    const diag = await externalPage.evaluate(() => ({
      eth: typeof window.ethereum !== 'undefined',
      testids: [...document.querySelectorAll('[data-testid^="wallet-"]')].map((e) => e.getAttribute('data-testid')),
    })).catch(() => null)
    console.log(`  [diag] ${JSON.stringify(diag)}`)
    if (!externalOnly && !inAppShown) console.log('  [!] El selector no se renderizó: revisar (D)')
    else fail('Con billetera inyectada todavía se ofrece la billetera de la aplicación (D)')
  }

  await externalPage.goto(`${base}/en?iappwallet=1`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(5000)
  if (await exists(externalPage, '[data-testid="wallet-open-dialog"]')) {
    ok('Con ?iappwallet=1 la billetera de la aplicación se ofrece (D)')
  } else {
    fail('?iappwallet=1 no ofreció la billetera de la aplicación (D)')
  }
  await externalPage.close()
  await incognito.close().catch(() => {})

  if (authenticatorId) {
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId }).catch(() => {})
  }
  console.log(`\n(entorno: ${base})`)
  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => { console.error(error); process.exit(1) })
