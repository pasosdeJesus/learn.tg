#!/usr/bin/env node
// E2E: cabecera + WalletDialog de la billetera de la aplicación (R-#238/R-#244).
//
// Los otros specs de billetera usan `/en/test/wallet` (la página de pruebas), así
// que no cubren el flujo real de la cabecera: crear/desbloquear en el modal,
// ingresar con SIWE, y que la cabecera **mantenga la sesión** al recargar. El
// operador encontró ese problema a mano (2026-09-15/16), por eso este spec.
//
// Necesita la rama desplegada (el modal y la cabecera con la sesión por cookie):
// si el sitio sirve código viejo, falla — que es justo lo que debe detectar.
//
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/header-wallet-dialog.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'

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

async function header(page) {
  return page.evaluate(() => {
    const selector = document.querySelector('[data-testid="wallet-selector"]')
    const inApp = document.querySelector('[data-testid="wallet-selector-in-app"]')
    return {
      button: (selector?.innerText || '').trim() || null,
      signedIn: (inApp?.innerText || '').replace(/\s+/g, ' ').trim() || null,
      hasDisconnect: !!document.querySelector('[data-testid="wallet-disconnect"]'),
    }
  })
}

async function sessionAddress(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/auth/session')
    if (!response.ok) return null
    const body = await response.json()
    return body?.address || null
  })
}

// El click se pierde si la página aún no hidrató: insistir hasta que abra.
async function openDialog(page) {
  for (let i = 0; i < 20; i++) {
    await page.click('[data-testid="wallet-open-dialog"]').catch(() => {})
    await sleep(700)
    if (await page.$('[data-testid="wallet-dialog"]')) return true
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
  const { base, timeout } = env

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(180000)
  page.on('console', (msg) => {
    if (/Hydration|hydration mismatch/i.test(msg.text())) console.log(`  [!] hidratación: ${msg.text().split('\n')[0]}`)
  })

  console.log(`Cabecera + modal de billetera | ${base}\n`)

  // 1. La cabecera ofrece la billetera de la aplicación
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await sleep(3500)
  const initial = await header(page)
  if (initial.button && !initial.signedIn) ok(`Cabecera sin sesión: "${initial.button}"`)
  else if (initial.signedIn) ok(`Ya hay sesión en esta billetera: "${initial.signedIn}"`)
  else fail('La cabecera no ofrece la billetera de la aplicación')

  // 2. Crear la billetera en el modal y cerrarlo (como hizo el operador)
  if (!(await page.$('[data-testid="wallet-selector-in-app"]'))) {
    await openDialog(page)
    const hasCreateForm = await page.waitForSelector('[data-testid="wallet-password-confirm"]', { timeout: 60000 }).catch(() => null)
    if (hasCreateForm) {
      await page.type('[data-testid="wallet-password"]', password)
      await page.type('[data-testid="wallet-password-confirm"]', password)
      await page.click('[data-testid="wallet-create"]')
      await page.waitForSelector('[data-testid="wallet-recovery-words"]', { timeout: 60000 })
      ok('Billetera creada y frase de recuperación visible')

      // Cerrar sin firmar: al reabrir debe volver al inicio del flujo (no a la frase)
      for (const button of await page.$$('button')) {
        const text = ((await button.evaluate((el) => el.innerText)) || '').trim()
        if (text === 'Close' || text === 'Cerrar') { await button.click(); break }
      }
      await sleep(1200)
      await openDialog(page)
      const reopened = await page.evaluate(() => {
        const dialog = document.querySelector('[data-testid="wallet-dialog"]')
        return {
          recovery: !!dialog?.querySelector('[data-testid="wallet-recovery-words"]'),
          unlock: !!dialog?.querySelector('[data-testid="wallet-unlock"]'),
          text: (dialog?.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
        }
      })
      if (reopened.recovery) fail('El modal reabrió en la frase de recuperación (debería empezar de nuevo)')
      else ok(`El modal reabre al inicio del flujo${reopened.unlock ? ' (desbloqueo)' : ''}`)
      await page.keyboard.press('Escape')
      await sleep(800)
    } else {
      console.log('  [i] la billetera ya existía en este perfil')
      await page.keyboard.press('Escape')
    }
  }

  // 3. Desbloquear desde la cabecera: el modal pide el password y firma el SIWE
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(3000)
  if (!(await page.$('[data-testid="wallet-selector-in-app"]'))) {
    await openDialog(page)
    const password = await page.waitForSelector('[data-testid="wallet-password"]', { timeout: 15000 }).catch(() => null)
    if (!password) {
      fail('El modal no mostró el formulario de password para desbloquear')
    } else {
      await page.type('[data-testid="wallet-password"]', password)
      await page.click('[data-testid="wallet-unlock"]')
      // El ingreso recarga la página (signIn + reload)
      for (let i = 0; i < 20; i++) {
        await sleep(1500)
        try {
          if ((await header(page)).signedIn) break
        } catch { /* navegando */ }
      }
    }
  }

  const afterSignIn = await header(page)
  const address = await sessionAddress(page)
  if (afterSignIn.signedIn) ok(`Tras ingresar, la cabecera muestra la sesión: "${afterSignIn.signedIn}"`)
  else fail(`Tras ingresar, la cabecera NO muestra la sesión (muestra "${afterSignIn.button}", sesión ${address ? 'sí' : 'no'})`)

  if (afterSignIn.hasDisconnect) ok('La cabecera ofrece desconectar (✕)')
  else fail('La cabecera no ofrece desconectar')

  // 4. Lo que reportó el operador: al recargar NO debe volver a pedir desbloqueo
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(4000)
  const afterReload = await header(page)
  const addressAfterReload = await sessionAddress(page)
  if (afterReload.signedIn) ok(`La sesión se mantiene tras recargar: "${afterReload.signedIn}"`)
  else fail(
    `Tras recargar la cabecera volvió a "${afterReload.button}"` +
    ` (sesión: ${addressAfterReload || 'ninguna'}) — ¿el sitio sirve un build anterior al arreglo de R-#238?`,
  )

  // 5. Desconectar (✕) deja la cabecera lista para volver a entrar
  if (afterReload.hasDisconnect) {
    await page.click('[data-testid="wallet-disconnect"]')
    for (let i = 0; i < 12; i++) {
      await sleep(2000)
      try {
        const state = await header(page)
        if (!state.signedIn && state.button) { ok(`Desconectado: la cabecera vuelve a "${state.button}"`); break }
      } catch { /* navegando */ }
      if (i === 11) fail('Tras desconectar la cabecera no volvió al estado sin sesión')
    }
  }

  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => { console.error(error); process.exit(1) })
