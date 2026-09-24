#!/usr/bin/env node
// E2E: guía legible sin conexión (R-#241).
//
// Requiere la rama con el PWA desplegada en el sitio de desarrollo (R-#240):
// sin service worker registrado el spec se OMITE en vez de fallar, porque el
// sitio sirve `main` hoy.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/offline-guide.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'

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

// Curso **gratuito** a propósito: R-#241 es "una guía ya visitada sigue legible sin
// conexión", y para que exista copia hay que haber podido leerla en línea. Con
// `/en/gdcluster/guide1` (premium) un visitante anónimo recibía 401 en `/api/guide`
// (medido 2026-09-24 en el sitio de desarrollo), así que no había Markdown guardado y
// el spec pasaba (o fallaba) midiendo la página `/offline` de respaldo, no la guía.
const GUIDE_PATH = '/en/web3-and-ubi/guide1'

async function bodyLength(page) {
  return page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().length)
}

/**
 * Espera a que la página tenga contenido real (encabezado + guía). Sin esto se
 * medía `bodyLength` inmediatamente después del `reload` y daba ~130 caracteres
 * (sólo el shell, antes de hidratar), lo que hacía fallar el spec aunque la guía
 * sí estuviera cacheada (medido 2026-09-21 en el dev site).
 */
async function waitBodyContent(page, timeout, label) {
  try {
    await page.waitForFunction(
      () => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().length > 200,
      { timeout },
    )
    return true
  } catch {
    console.log(`  [!] sin contenido (>200 caracteres) tras ${label}`)
    return false
  }
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

  // 1. Visita online: registra el service worker y cachea la guía.
  await page.goto(`${base}${GUIDE_PATH}`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => (document.body?.innerText || '').length > 200,
    { timeout },
  )

  const registration = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null
    // 60 s: en la primera visita el worker instala su precache (43 KB + chunks) y
    // en una VM lenta / con la red ocupada eso pasaba de los 10 s anteriores, así
    // que el spec se saltaba con "sin service worker registrado" aunque el sitio
    // sí lo tuviera (medido 2026-09-21 en el dev site).
    const ready = await Promise.race([
      navigator.serviceWorker.ready.catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 60000)),
    ])
    return ready ? (ready.active?.scriptURL || 'registered') : null
  })

  if (!registration) {
    console.log('[SKIP] sin service worker registrado — el PWA (R-#240) no está desplegado en este sitio')
    await browser.close()
    process.exit(0)
  }
  ok(`Service worker registrado (${String(registration).split('/').pop()})`)

  // El worker de desarrollo (next dev) es NetworkOnly y sin precache: no puede
  // servir nada offline, así que el offline solo se verifica en un build de
  // producción. Se detecta por el contenido del propio /sw.js.
  const swSource = await fetch(`${base}/sw.js`).then((r) => (r.ok ? r.text() : '')).catch(() => '')
  const isDevWorker = /NetworkOnly/.test(swSource) && !/precacheAndRoute/.test(swSource)
  if (isDevWorker) {
    console.log('[SKIP] el sitio sirve el worker de desarrollo (NetworkOnly, sin precache): el offline se prueba en un build de producción')
    await browser.close()
    process.exit(0)
  }

  // Recarga: la página pasa a estar controlada por el service worker y el
  // handler NetworkFirst guarda el HTML de la guía.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout })
  ok('La página está controlada por el service worker')
  await waitBodyContent(page, timeout, 'la recarga controlada por el SW')

  // 2. Sin conexión: la guía debe seguir leyéndose desde la caché.
  await page.setOfflineMode(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
  } catch (error) {
    console.log(`  [!] La recarga sin conexión falló: ${error.message}`)
  }
  await waitBodyContent(page, 30000, 'la recarga sin conexión')
  const offlineLength = await bodyLength(page)
  const offlineText = await page.evaluate(() => document.body?.innerText || '')

  // La página de respaldo (`app/offline/page.tsx`) es más larga que 200 caracteres, así
  // que medir solo la longitud daba por buena la guía cuando en realidad se servía
  // `/offline` (reporte del análisis del 2026-09-24: los "289 caracteres" de 2026-09-21
  // eran la de respaldo). Se reconoce por su frase propia.
  const isFallback = /Your progress is saved and will sync when the connection returns/.test(offlineText)
  if (isFallback) {
    fail('Sin conexión se sirvió la página de respaldo /offline en vez de la guía guardada')
  } else if (offlineLength > 200) {
    ok(`La guía sigue visible sin conexión (${offlineLength} caracteres)`)
  } else {
    fail(`La guía no se pudo leer sin conexión (${offlineLength} caracteres)`)
  }

  const banner = await page.$('[data-testid="offline-banner"]')
  if (banner) ok('Se muestra el banner de sin conexión')
  else fail('No apareció el banner de sin conexión')

  // 3. Vuelve la conexión.
  await page.setOfflineMode(false)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitBodyContent(page, timeout, 'volver a estar en línea')
  const backOnline = await bodyLength(page)
  if (backOnline > 200) ok('Con conexión la guía vuelve a cargarse')
  else fail(`Con conexión la guía quedó vacía (${backOnline} caracteres)`)

  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
