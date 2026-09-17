#!/usr/bin/env node
// E2E: desbloquear la billetera in-app desde el modal de donación (R-#244).
//
// El operador lo reportó a mano (2026-09-16): abrió el modal de donación de un
// curso, apareció el aviso "Tu billetera de la aplicación está bloqueada" con el
// botón para desbloquear, lo presionó y **no pasó nada**.
//
// Escenario real que se reproduce: la billetera ya está creada y la sesión está
// firmada (pestaña A). En una **pestaña nueva** la cookie de sesión sigue ahí
// (la cabecera muestra la dirección conectada) pero la billetera está bloqueada,
// porque la clave vive por pestaña. Entonces:
//
//  1. el modal de donación ofrece desbloquear;
//  2. el botón abre `WalletDialog` ENCIMA del modal (era el defecto: el diálogo
//     no estaba montado con sesión iniciada, así que el evento no tenía quien lo
//     escuchara);
//  3. el PIN deja el modal usable (el aviso desaparece);
//  4. tras recargar esa pestaña, el desbloqueo recordado evita volver a pedir el
//     PIN aunque la cabecera siga mostrando la sesión.
//
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/donate-unlock-dialog.spec.mjs

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

// El click se pierde si la página aún no hidrató: insistir hasta que abra.
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

async function waitForSession(page, base, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await header(page)).signedIn) return true
    await sleep(1500)
  }
  return false
}

/** Pestaña A: crea la billetera en la cabecera, la desbloquea y firma el SIWE. */
async function signInFromHeader(page, base) {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(
    '[data-testid="wallet-selector"], [data-testid="wallet-selector-in-app"]',
    { timeout: 90000 },
  ).catch(() => {})
  await sleep(2500)

  if (!(await exists(page, '[data-testid="wallet-selector-in-app"]'))) {
    if (!(await openDialog(page))) {
      fail('La cabecera no abrió el diálogo de la billetera')
      return false
    }
    const createForm = await page.waitForSelector('[data-testid="wallet-pin-confirm"]', { timeout: 25000 }).catch(() => null)
    if (createForm) {
      await page.type('[data-testid="wallet-pin"]', PIN)
      await page.type('[data-testid="wallet-pin-confirm"]', PIN)
      await page.click('[data-testid="wallet-create"]')
      await page.waitForSelector('[data-testid="wallet-recovery-words"]', { timeout: 60000 })
      ok('Billetera in-app creada')
      // "Guardé las palabras, ingresar" firma el SIWE y recarga
      await page.click('[data-testid="wallet-signin"]').catch(() => {})
    } else if (await exists(page, '[data-testid="wallet-unlock"]')) {
      await page.type('[data-testid="wallet-pin"]', PIN)
      await page.click('[data-testid="wallet-unlock"]')
    } else if (await exists(page, '[data-testid="wallet-signin"]')) {
      await page.click('[data-testid="wallet-signin"]')
    } else {
      await closeDialog(page)
    }
  }

  if (!(await waitForSession(page, base))) {
    fail('No se consiguió una sesión con la billetera in-app')
    return false
  }
  ok(`Sesión de la billetera in-app en la pestaña A: "${(await header(page)).signedIn}"`)
  return true
}

/**
 * Abre el modal de donación del curso y devuelve lo que muestra: si aparece el
 * aviso de billetera bloqueada y el texto del modal.
 */
async function openDonateModal(page, base, urls = [`${base}/en/gdcluster`, `${base}/en`]) {
  for (const url of urls) {
    // La app puede navegar por su cuenta; no es motivo para abortar el spec.
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForSelector('button', { timeout: 90000 }).catch(() => {})
    for (let i = 0; i < 20; i++) {
      await sleep(1500)
      const clicked = await page.evaluate(() => {
        const label = /Donate to this course|Donar a este curso/i
        const button = [...document.querySelectorAll('button')].find((b) => label.test(b.innerText || ''))
        if (!button) return false
        button.scrollIntoView({ block: 'center' })
        button.click()
        return true
      })
      if (!clicked) continue
      for (let w = 0; w < 10; w++) {
        await sleep(1000)
        const state = await page.evaluate(() => {
          const overlay = document.querySelector('.fixed.inset-0')
          if (!overlay) return null
          return {
            notice: !!document.querySelector('[data-testid="wallet-unlock-request"]'),
            text: (overlay.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
          }
        })
        if (state) return state
      }
    }
  }
  return null
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
  // `initTestEnv` siempre construye https://; un servidor local de desarrollo
  // (`next dev -p 4000`) sirve HTTP, así que se puede apuntar con SITE_URL.
  const base = process.env.SITE_URL || env.base

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(120000)

  console.log(`Donación + desbloqueo de la billetera | ${base}\n`)

  // Pestaña A: billetera creada, desbloqueada y sesión firmada.
  if (!(await signInFromHeader(page, base))) {
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }
  const address = (await header(page)).signedIn

  // Pestaña B: misma sesión (cookie), billetera bloqueada (la clave es por pestaña)
  const locked = await browser.newPage()
  await locked.setDefaultNavigationTimeout(120000)
  await locked.goto(`${base}/en/gdcluster`, { waitUntil: 'domcontentloaded' })
  await locked.waitForSelector('button', { timeout: 90000 }).catch(() => {})
  await sleep(4000)

  const stateB0 = await header(locked)
  let stateB = stateB0
  if (!stateB.signedIn) {
    // La cookie de sesión compartida puede tardar en resolverse en la pestaña
    // nueva (o quedar sin hidratar): recargar una vez y esperar.
    await locked.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
    await waitForSession(locked, base, 45000)
    stateB = await header(locked)
  }
  if (!stateB.signedIn) {
    fail(`La pestaña nueva no heredó la sesión (cabecera: "${stateB.button}")`)
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }
  if (stateB.signedIn !== address) {
    fail(`La cabecera de la pestaña nueva muestra otra dirección: "${stateB.signedIn}"`)
  } else {
    ok(`Pestaña nueva con la sesión de la cabecera: "${stateB.signedIn}"`)
  }

  const opened = await openDonateModal(locked, base)
  if (!opened) {
    fail('El modal de donación no abrió con la sesión de la billetera in-app')
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }
  if (!opened.notice) {
    fail(`El modal no ofreció desbloquear la billetera (texto: ${opened.text})`)
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }
  ok('El modal de donación ofrece desbloquear la billetera')

  // Lo que reportó el operador: el botón no hacía nada
  await locked.click('[data-testid="wallet-unlock-request"]')
  let dialog = null
  for (let i = 0; i < 15; i++) {
    await sleep(1000)
    dialog = await locked.evaluate(() => {
      const el = document.querySelector('[data-testid="wallet-dialog"]')
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      // El modal de donación también usa z-50: si el diálogo queda debajo, el
      // usuario ve "nada" aunque el nodo exista.
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return {
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        onTop: !!top && (el === top || el.contains(top)),
        text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
        hasPin: !!el.querySelector('[data-testid="wallet-pin"]'),
      }
    })
    if (dialog) break
  }

  if (!dialog) {
    fail('Presionar "desbloquear" en el modal de donación NO abrió el diálogo de la billetera')
  } else if (!dialog.visible) {
    fail(`El diálogo de la billetera se abrió pero no es visible: ${JSON.stringify(dialog)}`)
  } else if (!dialog.onTop) {
    fail(`El diálogo de la billetera se abrió DEBAJO del modal de donación (z-index): ${JSON.stringify(dialog)}`)
  } else if (!dialog.hasPin) {
    fail(`El diálogo de la billetera se abrió sin el formulario de PIN: ${dialog.text}`)
  } else {
    ok(`El diálogo de la billetera se abrió sobre el modal: "${dialog.text}"`)

    await locked.type('[data-testid="wallet-pin"]', PIN)
    await locked.click('[data-testid="wallet-unlock"]')
    await locked.waitForFunction(
      () => !document.querySelector('[data-testid="wallet-pin"]'),
      { timeout: 30000 },
    ).then(() => ok('El PIN desbloquea la billetera')).catch(() => fail('El PIN no desbloqueó la billetera'))

    // Con la billetera desbloqueada el aviso desaparece y el modal queda usable
    await sleep(1500)
    const after = await locked.evaluate(() => {
      const overlay = document.querySelector('.fixed.inset-0')
      return {
        notice: !!document.querySelector('[data-testid="wallet-unlock-request"]'),
        text: (overlay?.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
      }
    })
    if (after.notice) fail(`Tras desbloquear, el aviso sigue en el modal: ${after.text}`)
    else ok('Tras desbloquear, el aviso desaparece')

    // 4. El desbloqueo queda recordado en esta pestaña: recargar no vuelve a
    // pedir el PIN mientras la cabecera siga mostrando la sesión.
    await locked.reload({ waitUntil: 'domcontentloaded' })
    await sleep(5000)
    const currentUrl = locked.url()
    const reopened = await openDonateModal(locked, base, [
      currentUrl,
      `${base}/en/gdcluster`,
      `${base}/en`,
    ])
    if (!reopened) {
      fail('Tras recargar, el modal de donación no abrió')
    } else if (reopened.notice) {
      fail(`Tras recargar la pestaña, el modal vuelve a pedir desbloquear: ${reopened.text}`)
    } else {
      ok('Tras recargar la pestaña, la billetera sigue desbloqueada (no pide PIN)')
    }
  }

  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => { console.error(error); process.exit(1) })
