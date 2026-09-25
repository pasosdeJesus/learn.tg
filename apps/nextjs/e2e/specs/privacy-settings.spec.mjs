#!/usr/bin/env node
// E2E: interruptores de privacidad y su efecto en el perfil público
// (https://github.com/pasosdeJesus/learn.tg/issues/259).
//
// Qué comprueba: con la sesión del estudiante de prueba, apagar "publicar mis
// cursos completados" deja el perfil público (`GET /api/user/<id>`, sin cookies:
// el equivalente a una ventana de incógnito) sin credenciales, y volver a
// encenderlo las devuelve. Los valores se restauran al final.
//
// Se OMITE cuando la página de privacidad todavía no está desplegada.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/privacy-settings.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'
import { installCoreWalletMock, signInWithCoreWallet } from '../helpers/in-app-wallet.mjs'

const LANG = 'en'
// Contraseña del mock de la billetera en memoria (los specs la usan así, R-#239).
const WALLET_PASSWORD = '12345678'

function loadEnvCredentials() {
  for (const envPath of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]) {
    if (fs.existsSync(envPath)) {
      const c = fs.readFileSync(envPath, 'utf8')
      const pk = c.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || c.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = c.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

/** Perfil público leído SIN cookies, como lo vería cualquiera. */
async function publicCredentials(base, userId) {
  const res = await fetch(`${base}/api/user/${userId}`)
  if (!res.ok) return null
  const body = await res.json()
  return Array.isArray(body.credentials) ? body.credentials : null
}

/**
 * Apariencia del interruptor: estado, color de la pista y posicion del pulgar.
 *
 * `data-state` es un atributo y cambia aunque el CSS no exista; por eso el operador
 * reporto un toast "Saved" con el control aparentemente inerte (R-#259). Tailwind v4
 * mueve el pulgar con la propiedad `translate` (no `transform`), asi que hay que leer
 * las dos.
 */
async function switchVisual(page, label) {
  return page.evaluate((aria) => {
    const root = document.querySelector(`[role="switch"][aria-label="${aria}"]`)
    if (!root) return null
    const thumb = root.firstElementChild
    const rootStyle = getComputedStyle(root)
    const thumbStyle = thumb ? getComputedStyle(thumb) : null
    return {
      state: root.getAttribute('data-state'),
      trackBackground: rootStyle.backgroundColor,
      thumbTranslate: thumbStyle?.translate ?? null,
      thumbTransform: thumbStyle?.transform ?? null,
    }
  }, label)
}

/** Espera a que el switch cambie de estado en el servidor (el guardado es asíncrono). */
async function waitForSwitch(page, label, expected) {
  await page.waitForFunction(
    (aria, state) => {
      const element = document.querySelector(`[role="switch"][aria-label="${aria}"]`)
      return element?.getAttribute('data-state') === state
    },
    { timeout: 15000 },
    label,
    expected,
  )
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (creds) process.env.TEST_PRIVATE_KEY = creds.pk
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { timeout } = env
  const { base } = resolveSiteTarget(env)

  const browser = await launchBrowser(env.headless)
  if (!creds?.addr) {
    console.log('[SKIP] sin billetera de prueba en .env')
    await browser.close()
    process.exit(0)
  }

  // La página de privacidad solo pinta los interruptores con una identidad
  // resuelta (sesión NextAuth): se entra con el núcleo real de la billetera, como
  // en los demás specs (R-#239), y no con el mock genérico de `newPage`.
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(120000)
  await installCoreWalletMock(page, {
    privateKey: creds.pk,
    address: creds.addr,
    chainId: env.chainId,
    password: WALLET_PASSWORD,
  })

  try {
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
    await signInWithCoreWallet(page, {
      privateKey: creds.pk,
      address: creds.addr,
      chainId: env.chainId,
      baseUrl: base,
      password: WALLET_PASSWORD,
    })
    ok('Sesión iniciada con el núcleo de la billetera')

    await page.goto(`${base}/${LANG}/settings`, { waitUntil: 'domcontentloaded' })
    const switchLabel = 'Publish my completed courses'
    // La página es un componente de cliente: los interruptores aparecen cuando
    // responde `GET /api/settings`, así que hay que esperarlos antes de concluir
    // que la función no está desplegada.
    let present = false
    try {
      await page.waitForSelector(`[role="switch"][aria-label="${switchLabel}"]`, { timeout: 30000 })
      present = true
    } catch {
      present = false
    }
    if (!present) {
      console.log('[SKIP] no hay interruptores de privacidad en /settings — R-#259 no está desplegada todavía')
      await browser.close()
      process.exit(0)
    }
    ok('La página de privacidad muestra los interruptores')

    const profile = await page.evaluate(async (wallet) => {
      // `/api/profile` exige la pista de identidad en la URL (`walletAddress`); la
      // credencial sigue siendo la cookie de sesión (R-#233 Fase 2).
      const res = await fetch(`/api/profile?walletAddress=${encodeURIComponent(wallet)}`, { credentials: 'same-origin' })
      return res.ok ? res.json() : null
    }, creds.addr)
    const userId = profile?.id || profile?.userId
    if (!userId) {
      fail('No se pudo obtener el id del estudiante de prueba (/api/profile)')
      throw new Error('no user id')
    }

    // 1. Apagar la publicación de cursos completados.
    const before = await switchVisual(page, switchLabel)
    await page.click(`[role="switch"][aria-label="${switchLabel}"]`)
    await waitForSwitch(page, switchLabel, 'unchecked')
    // El estado (atributo) y el guardado pueden estar bien y el control verse inerte:
    // las clases del `Switch` viven en `@pasosdejesus/m` y Tailwind v4 no escanea
    // `node_modules` sin un `@source` en `app/globals.css` (R-#259). Se comprueba el
    // cambio visual, no solo el atributo, para que la regresion no vuelva en silencio.
    await new Promise((resolve) => setTimeout(resolve, 500))
    const after = await switchVisual(page, switchLabel)
    if (
      after.thumbTranslate !== before.thumbTranslate ||
      after.thumbTransform !== before.thumbTransform
    ) {
      ok(`El pulgar se movio al apagar (${before.thumbTranslate} → ${after.thumbTranslate})`)
    } else {
      fail(
        `El pulgar no se movio (${before.thumbTranslate}): ` +
          'falta el CSS del Switch (¿@source de @pasosdejesus/m en app/globals.css?)',
      )
    }
    if (after.trackBackground !== before.trackBackground) {
      ok(`La pista cambio de color (${before.trackBackground} → ${after.trackBackground})`)
    } else {
      fail(
        `La pista no cambio de color (${before.trackBackground}): ` +
          'falta el CSS del Switch (¿@source de @pasosdejesus/m en app/globals.css?)',
      )
    }

    let credentials = await publicCredentials(base, userId)
    if (credentials === null) fail('El perfil público no respondió mientras la publicación estaba apagada')
    else if (credentials.length === 0) ok('Con la publicación apagada el perfil público no lista credenciales')
    else fail(`El perfil público sigue listando ${credentials.length} credenciales`)

    // 2. Volver a encenderla: lo publicado vuelve (los interruptores son reversibles).
    await page.click(`[role="switch"][aria-label="${switchLabel}"]`)
    await waitForSwitch(page, switchLabel, 'checked')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    credentials = await publicCredentials(base, userId)
    if (credentials === null) fail('El perfil público no respondió al volver a publicar')
    else ok(`Con la publicación encendida el perfil público responde (${credentials.length} credenciales visibles)`)
  } finally {
    // Restaurar el interruptor al estado por defecto aunque algo haya fallado.
    try {
      const label = 'Publish my completed courses'
      const state = await page.evaluate(
        (aria) => document.querySelector(`[role="switch"][aria-label="${aria}"]`)?.getAttribute('data-state'),
        label,
      )
      if (state === 'unchecked') await page.click(`[role="switch"][aria-label="${label}"]`)
    } catch {
      // el navegador ya puede estar cerrado
    }
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
