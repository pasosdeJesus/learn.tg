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

const GUIDE_PATH = '/en/gdcluster/guide1'

async function bodyLength(page) {
  return page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().length)
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
  const { base, timeout } = env

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
    const ready = await Promise.race([
      navigator.serviceWorker.ready.catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 10000)),
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

  // 2. Sin conexión: la guía debe seguir leyéndose desde la caché.
  await page.setOfflineMode(true)
  let offlineLength = 0
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    offlineLength = await bodyLength(page)
  } catch (error) {
    offlineLength = 0
    console.log(`  [!] La recarga sin conexión falló: ${error.message}`)
  }

  if (offlineLength > 200) ok(`La guía sigue visible sin conexión (${offlineLength} caracteres)`)
  else fail(`La guía no se pudo leer sin conexión (${offlineLength} caracteres)`)

  const banner = await page.$('[data-testid="offline-banner"]')
  if (banner) ok('Se muestra el banner de sin conexión')
  else fail('No apareció el banner de sin conexión')

  // 3. Vuelve la conexión.
  await page.setOfflineMode(false)
  await page.reload({ waitUntil: 'domcontentloaded' })
  const backOnline = await bodyLength(page)
  if (backOnline > 200) ok('Con conexión la guía vuelve a cargarse')
  else fail(`Con conexión la guía quedó vacía (${backOnline} caracteres)`)

  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
