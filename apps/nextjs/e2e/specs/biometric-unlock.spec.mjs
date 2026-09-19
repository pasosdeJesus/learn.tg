#!/usr/bin/env node
// E2E: desbloqueo por huella de la billetera in-app (R-#246, capa L2).
//
// Conduce el flujo real de la cabecera + `WalletDialog`:
//
//  1. crea la billetera y firma (SIWE);
//  2. al abrir el diálogo otra vez, activa "desbloquear con huella la próxima vez"
//     (mismo PIN, un paso más) y firma;
//  3. recarga: la clave salió de memoria, pero el diálogo ofrece
//     `wallet-unlock-biometric` y un gesto deja la billetera lista;
//  4. el PIN sigue funcionando como respaldo.
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

const PIN = '123456'
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
      const createForm = await page.waitForSelector('[data-testid="wallet-pin-confirm"]', { timeout: 25000 }).catch(() => null)
      if (createForm) {
        await page.type('[data-testid="wallet-pin"]', PIN)
        await page.type('[data-testid="wallet-pin-confirm"]', PIN)
        await page.click('[data-testid="wallet-create"]')
        await page.waitForSelector('[data-testid="wallet-recovery-words"]', { timeout: 60000 })
        ok('Billetera in-app creada')
        await page.click('[data-testid="wallet-signin"]').catch(() => {})
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
    enableButton = await exists(page, '[data-testid="wallet-enable-biometric"]')
    if (enableButton) {
      await page.type('[data-testid="wallet-pin"]', PIN)
      await page.click('[data-testid="wallet-enable-biometric"]')
      for (let i = 0; i < 25; i++) {
        await sleep(1500)
        if ((await header(page)).signedIn) break
      }
      ok('Activó el desbloqueo por huella (passkey + PRF) y volvió a firmar')
    } else if (await exists(page, '[data-testid="wallet-unlock"]')) {
      // El sitio desplegado puede no tener todavía la UI de R-#246: usar el PIN
      await page.type('[data-testid="wallet-pin"]', PIN)
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

  // 3. Recargar otra vez: el gesto debe reemplazar al PIN
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(5000)
  const afterReload = await header(page)
  if (afterReload.signedIn) {
    ok(`La sesión se mantiene tras recargar: "${afterReload.signedIn}"`)
  } else {
    fail(`Tras recargar la cabecera quedó en "${afterReload.button}"`)
  }

  if (await openDialog(page)) {
    const hasBiometric = await exists(page, '[data-testid="wallet-unlock-biometric"]')
    // Con R-#246 el gesto arranca al abrir el diálogo, así que también es válido
    // que ya se haya cerrado (el authenticator virtual se auto-verifica).
    const gestureAlreadyDone = !(await exists(page, '[data-testid="wallet-dialog"]'))
    if (!hasBiometric && !gestureAlreadyDone) {
      fail('El diálogo no ofreció el desbloqueo por huella')
    } else {
      ok('El diálogo ofrece "desbloquear con huella"')
      // R-#246: con la passkey registrada el gesto se pide al abrir el diálogo y
      // el SIGNO de que funcionó es que el diálogo se cierre (la firma cierra y
      // recarga). Tolerante con builds anteriores, donde hay que presionar el
      // botón: se espera primero y solo se presiona si no pasó nada.
      let unlocked = gestureAlreadyDone
      const dialogGone = async () => !(await exists(page, '[data-testid="wallet-dialog"]'))
      for (let i = 0; i < 12; i++) {
        await sleep(1500)
        if (await dialogGone()) { unlocked = true; break }
      }
      if (!unlocked) {
        await page.click('[data-testid="wallet-unlock-biometric"]')
        for (let i = 0; i < 20; i++) {
          await sleep(1500)
          if (await dialogGone()) { unlocked = true; break }
        }
      }
      if (unlocked) ok('El gesto desbloqueó la billetera sin teclear el PIN')
      else fail('El gesto no desbloqueó la billetera')

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
