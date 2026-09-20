#!/usr/bin/env node
// E2E: desbloqueo por huella de la billetera in-app (R-#246, capa L2).
//
// Conduce el flujo real de la cabecera + `WalletDialog`:
//
//  1. crea la billetera y firma (SIWE);
//  2. al abrir el diálogo otra vez, activa "desbloquear con huella la próxima vez"
//     (mismo password, un paso más) y firma;
//  3. recarga: la clave salió de memoria, pero el diálogo ofrece
//     `wallet-unlock-biometric` y un gesto deja la billetera lista;
//  4. el password sigue funcionando como respaldo.
//
// El "gesto" lo simula un authenticator virtual de Chrome por CDP
// (`WebAuthn.addVirtualAuthenticator` con `hasPrf: true`), que auto-verifica al
// usuario. En un teléfono eso es Face ID / huella.
//
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/biometric-unlock.spec.mjs
//
// SITE_URL permite apuntar a un servidor local (`next dev -p 4000`, HTTP).

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { completeBackupVerification } from '../helpers/in-app-wallet.mjs'

const password = '12345678'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function exists(page, selector) {
  try {
    return !!(await page.$(selector))
  } catch {
    return false
  }
}

/** Texto del error que muestre el diálogo de la billetera, si hay alguno. */
async function dialogError(page) {
  try {
    return await page.$eval('[data-testid="wallet-dialog-error"]', (el) => el.textContent || '')
  } catch {
    return null
  }
}

/**
 * Diagnóstico: qué quedó realmente en IndexedDB (versión, almacenes y las
 * direcciones de los registros de password y de huella). Sirve para distinguir "no se
 * selló" de "se selló y no se leyó".
 */
async function dumpWalletDb(page) {
  try {
    return await page.evaluate(async () => {
      const name = 'learn-tg-pdj-wallet'
      const list = (await indexedDB.databases?.()) || []
      const known = list.find((d) => d.name === name)
      if (!known) return { exists: false }
      return await new Promise((resolve) => {
        const open = indexedDB.open(name)
        open.onerror = () => resolve({ exists: true, version: known.version, error: 'open failed' })
        open.onsuccess = () => {
          const db = open.result
          const stores = Array.from(db.objectStoreNames)
          const out = { exists: true, version: db.version, stores }
          if (!stores.length) return resolve(out)
          const tx = db.transaction(stores, 'readonly')
          const read = (store) =>
            new Promise((res) => {
              if (!stores.includes(store)) return res(null)
              const req = tx.objectStore(store).get('current')
              req.onsuccess = () => res(req.result || null)
              req.onerror = () => res(null)
            })
          Promise.all([read('wallet'), read('biometric')]).then(([w, b]) => {
            out.wallet = w ? { address: w.address, version: w.version } : null
            out.biometric = b ? { address: b.address, credentialId: String(b.credentialId).slice(0, 10) } : null
            resolve(out)
          })
        }
      })
    })
  } catch (e) {
    return { error: String(e) }
  }
}

async function header(page) {
  try {
    return await page.evaluate(() => {
      const inApp = document.querySelector('[data-testid="wallet-selector-in-app"]')
      return {
        signedIn: (inApp?.innerText || '').replace(/\s+/g, ' ').trim() || null,
        button: (document.querySelector('[data-testid="wallet-open-dialog"]')?.innerText || '').trim() || null,
      }
    })
  } catch {
    return { signedIn: null, button: null }
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

async function waitForHeaderSession(page, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await header(page)).signedIn) return true
    await sleep(1500)
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
  const base = process.env.SITE_URL || env.base
  const host = new URL(base).hostname

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(180000)

  console.log(`Desbloqueo por huella (L2) | ${base}\n`)

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
    fail(`El Chrome de este entorno no soporta authenticator virtual con PRF: ${String(e).slice(0, 120)}`)
    return { authenticatorId: null }
  })

  // 1. Crear la billetera en la cabecera y firmar
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await sleep(6000)
  if (!(await exists(page, '[data-testid="wallet-selector-in-app"]'))) {
    if (!(await openDialog(page))) {
      fail('La cabecera no abrió el diálogo de la billetera')
    } else {
      const createForm = await page.waitForSelector('[data-testid="wallet-password-confirm"]', { timeout: 25000 }).catch(() => null)
      if (createForm) {
        await page.type('[data-testid="wallet-password"]', password)
        await page.type('[data-testid="wallet-password-confirm"]', password)
        await page.click('[data-testid="wallet-create"]')
        await page.waitForSelector('[data-testid="wallet-recovery-words"]', { timeout: 60000 })
        ok('Billetera in-app creada')
        await completeBackupVerification(page)
      } else {
        await closeDialog(page)
      }
    }
  }
  if (!(await waitForHeaderSession(page))) {
    fail('No se consiguió sesión con la billetera in-app')
  } else {
    ok(`Sesión de la billetera in-app: "${(await header(page)).signedIn}"`)
  }

  // 2. Tras recargar la clave sale de memoria: activar el desbloqueo por huella
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(5000)

  let enableButton = false
  if (await openDialog(page)) {
    // El diálogo carga su estado del hook (IndexedDB + detección de plataforma)
    // después de abrirse: en `next dev` tarda, así que se espera la oferta en vez
    // de mirar una sola vez.
    for (let i = 0; i < 20; i++) {
      enableButton = await exists(page, '[data-testid="wallet-enable-biometric"]')
      if (enableButton) break
      await sleep(1000)
    }
    if (enableButton) {
      await page.type('[data-testid="wallet-password"]', password)
      await page.click('[data-testid="wallet-enable-biometric"]')
      // El ok() no puede ser incondicional (lo era y ocultaba fallos): se espera la
      // señal real —el error en el diálogo, o su cierre (la firma con la sesión ya
      // existente cierra el modal sin recargar)—.
      for (let i = 0; i < 25; i++) {
        await sleep(1500)
        const err = await dialogError(page)
        if (err) {
          fail(`No se pudo activar el desbloqueo por huella: ${err}`)
          break
        }
        if (!(await exists(page, '[data-testid="wallet-dialog"]'))) {
          ok('Activó el desbloqueo por huella (passkey + PRF)')
          break
        }
      }
    } else if (await exists(page, '[data-testid="wallet-unlock"]')) {
      // El sitio desplegado puede no tener todavía la UI de R-#246: usar el password
      await page.type('[data-testid="wallet-password"]', password)
      await page.click('[data-testid="wallet-unlock"]')
      for (let i = 0; i < 25; i++) {
        await sleep(1500)
        if ((await header(page)).signedIn) break
      }
    } else {
      await closeDialog(page)
    }
  }

  if (!enableButton) {
    fail(`El diálogo no ofreció activar el desbloqueo por huella (cabecera: "${(await header(page)).button}")`)
  }

  // 3. Recargar otra vez: el gesto debe reemplazar al password
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(5000)
  const afterReload = await header(page)
  if (afterReload.signedIn) {
    ok(`La sesión se mantiene tras recargar: "${afterReload.signedIn}"`)
  } else {
    fail(`Tras recargar la cabecera quedó en "${afterReload.button}"`)
  }

  if (await openDialog(page)) {
    // R-#246: con la passkey registrada el gesto arranca al abrir el diálogo, así
    // que el desbloqueo puede completarse ANTES de que alcancemos a ver el botón:
    // el diálogo pasa a su estado desbloqueado (sin campo de password) y luego se cierra
    // con la recarga de la firma. Tres señales válidas: el botón, el diálogo
    // cerrado, o el diálogo ya desbloqueado. Lo último deja de valer en builds
    // anteriores, donde el formulario espera a que se presione el botón.
    let hasBiometric = false
    let unlockedByAutoGesture = false
    for (let i = 0; i < 15; i++) {
      if (await exists(page, '[data-testid="wallet-unlock-biometric"]')) {
        hasBiometric = true
        break
      }
      // Señal de "ya está desbloqueada": los botones de desbloqueo sólo existen en
      // el estado bloqueado (el campo de password se renderiza también desbloqueada, así
      // que no sirve como señal).
      const dialogOpen = await exists(page, '[data-testid="wallet-dialog"]')
      const lockedUi =
        (await exists(page, '[data-testid="wallet-unlock"]')) ||
        (await exists(page, '[data-testid="wallet-unlock-biometric"]'))
      if (!dialogOpen || !lockedUi) {
        unlockedByAutoGesture = true
        break
      }
      await sleep(1000)
    }

    if (!hasBiometric && !unlockedByAutoGesture) {
      const db = await dumpWalletDb(page)
      const buttons = await page
        .$$eval('[data-testid^="wallet-"]', (els) => els.map((e) => e.getAttribute('data-testid')))
        .catch(() => [])
      console.log(`  [diag] IndexedDB: ${JSON.stringify(db)}`)
      console.log(`  [diag] testids en la página: ${JSON.stringify(buttons)}`)
      fail('El diálogo no ofreció el desbloqueo por huella')
    } else {
      if (hasBiometric) ok('El diálogo ofrece "desbloquear con huella"')
      else ok('El gesto se pidió al abrir el diálogo y la billetera quedó lista')
      let unlocked = unlockedByAutoGesture
      const dialogGone = async () => !(await exists(page, '[data-testid="wallet-dialog"]'))
      if (!unlocked) {
        for (let i = 0; i < 12; i++) {
          await sleep(1500)
          if (await dialogGone()) { unlocked = true; break }
        }
      }
      if (!unlocked) {
        await page.click('[data-testid="wallet-unlock-biometric"]')
        for (let i = 0; i < 20; i++) {
          await sleep(1500)
          if (await dialogGone()) { unlocked = true; break }
        }
      }
      if (unlocked) ok('El gesto desbloqueó la billetera sin teclear el password')
      else fail('El gesto no desbloqueó la billetera')

      // Deja que termine la recarga de la firma antes de navegar.
      await sleep(3000)

      // Con la billetera lista, el modal de donación ya no pide desbloquear
      await page.goto(`${base}/en/gdcluster`, { waitUntil: 'domcontentloaded' }).catch(() => {})
      await page.waitForSelector('button', { timeout: 90000 }).catch(() => {})
      await sleep(4000)
      const clicked = await page.evaluate(() => {
        const label = /Donate to this course|Donar a este curso/i
        const button = [...document.querySelectorAll('button')].find((b) => label.test(b.innerText || ''))
        if (!button) return false
        button.scrollIntoView({ block: 'center' })
        button.click()
        return true
      })
      if (clicked) {
        await sleep(4000)
        const notice = await exists(page, '[data-testid="wallet-unlock-request"]')
        if (notice) fail('El modal de donación sigue pidiendo desbloquear tras el gesto')
        else ok('El modal de donación quedó usable tras el gesto')
      }
    }
  } else {
    fail('No se pudo reabrir el diálogo para probar el gesto')
  }

  if (authenticatorId) {
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId }).catch(() => {})
  }
  console.log(`\n(entorno: ${host})`)
  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => { console.error(error); process.exit(1) })
