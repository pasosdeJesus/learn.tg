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
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'

const LANG = 'en'

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
  const page = await newPage(browser, creds?.addr, timeout)
  if (!creds?.addr) {
    console.log('[SKIP] sin billetera de prueba en .env')
    await browser.close()
    process.exit(0)
  }

  try {
    await page.goto(`${base}/${LANG}/settings`, { waitUntil: 'domcontentloaded' })
    const switchLabel = 'Publish my completed courses'
    const present = await page.evaluate(
      (aria) => !!document.querySelector(`[role="switch"][aria-label="${aria}"]`),
      switchLabel,
    )
    if (!present) {
      console.log('[SKIP] no hay interruptores de privacidad en /settings — R-#259 no está desplegada todavía')
      await browser.close()
      process.exit(0)
    }
    ok('La página de privacidad muestra los interruptores')

    const profile = await page.evaluate(async () => {
      const res = await fetch('/api/profile')
      return res.ok ? res.json() : null
    })
    const userId = profile?.id || profile?.userId
    if (!userId) {
      fail('No se pudo obtener el id del estudiante de prueba (/api/profile)')
      throw new Error('no user id')
    }

    // 1. Apagar la publicación de cursos completados.
    await page.click(`[role="switch"][aria-label="${switchLabel}"]`)
    await waitForSwitch(page, switchLabel, 'unchecked')

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
