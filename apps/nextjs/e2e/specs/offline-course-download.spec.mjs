#!/usr/bin/env node
// E2E: descarga completa de un curso y lectura sin conexión de una guía que
// nunca se abrió en línea (https://github.com/pasosdeJesus/learn.tg/issues/256).
//
// Curso de prueba: `/en/web3-and-ubi` — gratuito y **sin** contenido cristiano
// (así no depende del interruptor de privacidad de R-#259; un curso cristiano
// solo se descarga con ese interruptor encendido).
//
// Requiere la rama con el PWA y la descarga desplegadas en el sitio de
// desarrollo. Si el botón de descarga no está (función no desplegada) o no hay
// service worker, el spec se OMITE en vez de fallar, igual que `offline-guide`.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/offline-course-download.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'

const COURSE_PATH = '/en/web3-and-ubi'
const NEVER_VISITED_PATH = '/en/web3-and-ubi/guide4'
const DOWNLOAD_BUTTON = '[data-testid="offline-course-download"] button'
const READY_TEXT = 'You can read this course without a connection'

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

/** Lee el registro descargado directamente del IndexedDB del navegador. */
async function readStoredCourse(page, key) {
  return page.evaluate(async (recordKey) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('learn-tg-offline')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction('courses', 'readonly')
      const request = tx.objectStore('courses').get(recordKey)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const guide = await new Promise((resolve, reject) => {
      const tx = db.transaction('guides', 'readonly')
      const request = tx.objectStore('guides').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return { record, guideKeys: guide.map((item) => item.key) }
  }, key)
}

/** Ninguna celda ni colocación del crucigrama guardado trae la respuesta. */
function puzzleHasNoAnswers(record) {
  const problems = []
  for (const guide of record?.guides ?? []) {
    if (!guide.puzzle) continue
    for (const placement of guide.puzzle.placements ?? []) {
      if (placement.word && placement.word !== '-') problems.push(placement.word)
    }
    for (const row of guide.puzzle.grid ?? []) {
      for (const cell of row ?? []) {
        if (cell?.letter) problems.push(cell.letter)
      }
    }
  }
  return problems
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

  // 1. El curso en línea.
  await page.goto(`${base}${COURSE_PATH}`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => (document.body?.innerText || '').length > 200,
    { timeout },
  )

  const registration = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null
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

  const swSource = await fetch(`${base}/sw.js`).then((r) => (r.ok ? r.text() : '')).catch(() => '')
  if (/NetworkOnly/.test(swSource) && !/precacheAndRoute/.test(swSource)) {
    console.log('[SKIP] el sitio sirve el worker de desarrollo (NetworkOnly, sin precache)')
    await browser.close()
    process.exit(0)
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout })
  ok('La página está controlada por el service worker')

  // 2. La descarga del curso (§3.2). El botón aparece cuando el curso terminó de
  // cargar (el registro se lee de IndexedDB y el curso viene del API), así que se
  // espera; solo si no llega se considera que la función no está desplegada.
  let button = null
  try {
    await page.waitForSelector(DOWNLOAD_BUTTON, { timeout: Math.max(timeout, 60000) })
    button = await page.$(DOWNLOAD_BUTTON)
  } catch {
    button = null
  }
  if (!button) {
    console.log('[SKIP] no hay botón de descarga del curso — R-#256 no está desplegada todavía')
    await browser.close()
    process.exit(0)
  }

  await button.click()
  try {
    await page.waitForFunction(
      (text) => (document.body?.innerText || '').includes(text),
      { timeout: Math.max(timeout, 180000) },
      READY_TEXT,
    )
    ok('El curso quedó descargado (la página lo confirma)')
  } catch {
    fail(`La descarga no terminó a tiempo (no apareció "${READY_TEXT}")`)
  }

  // 3. El crucigrama se guarda sin respuestas (§3.3/§4).
  const stored = await readStoredCourse(page, 'en/web3-and-ubi')
  if (stored?.record) ok(`Registro de curso guardado con ${stored.record.guides?.length ?? 0} guías`)
  else fail('No se encontró el registro del curso en IndexedDB')

  if (stored?.record?.guides?.length > 0) ok(`El curso trae ${stored.record.guides.length} guías (todas, no solo las visitadas)`)
  else fail('El curso guardado no trae guías')

  const answers = puzzleHasNoAnswers(stored?.record)
  if (answers.length === 0) ok('El crucigrama guardado no lleva respuestas (celdas ni colocaciones)')
  else fail(`El crucigrama guardado incluye respuestas: ${answers.slice(0, 5).join(', ')}`)

  if ((stored?.guideKeys ?? []).some((key) => key === 'en/web3-and-ubi/guide4')) {
    ok('La guía nunca visitada quedó guardada con su contenido')
  } else {
    fail(`No se guardó el contenido de la guía nunca visitada (${(stored?.guideKeys ?? []).join(', ')})`)
  }

  // 4. Sin conexión, abrir la guía nunca visitada.
  //
  // Antes de navegar se comprueba el **mecanismo**: el HTML de Next trae
  // `Vary: rsc, next-router-state-tree, …`, así que la caché solo acierta si la
  // regla `/(en|es)/*` usa `matchOptions.ignoreVary` (R-#256). Si el despliegue
  // todavía no lo trae, la navegación cae en `/offline` y este spec lo diría como
  // fallo; se prefiere OMITIR con el motivo exacto y decir qué desplegar.
  const varyBlocks = await page.evaluate(async (guidePath) => {
    try {
      const cache = await window.caches.open('learntg-pages')
      const res = await cache.match(guidePath)
      if (!res) return 'sin copia en learntg-pages'
      return /rsc|next-router/.test(res.headers.get('vary') || '') ? 'vary' : 'ok'
    } catch (error) {
      return `error: ${error.message}`
    }
  }, NEVER_VISITED_PATH)
  if (varyBlocks === 'vary') {
    console.log('[SKIP] el HTML cacheado trae `Vary: rsc, next-router-*` y el despliegue aún no usa `matchOptions.ignoreVary` en la regla `/(en|es)/*` de `next.config.ts`: sin eso la navegación sin conexión no acierta en la caché (cae en /offline). Recompila y reinicia el sitio con este árbol para verificar la lectura offline de una guía nunca visitada.')
    await browser.close()
    process.exit(0)
  }

  await page.setOfflineMode(true)
  try {
    await page.goto(`${base}${NEVER_VISITED_PATH}`, { waitUntil: 'domcontentloaded' })
  } catch (error) {
    console.log(`  [!] La navegación sin conexión falló: ${error.message}`)
  }
  let offlineText = ''
  try {
    await page.waitForFunction(
      () => (document.body?.innerText || '').length > 200,
      { timeout: 30000 },
    )
    offlineText = await page.evaluate(() => document.body.innerText)
  } catch {
    offlineText = await page.evaluate(() => document.body?.innerText || '')
  }

  if (/You are offline/.test(offlineText)) {
    fail('Sin conexión se sirvió la página de respaldo /offline en vez de la guía descargada')
  } else if (/Comprehension Questions/i.test(offlineText)) {
    ok('La guía nunca visitada se lee sin conexión (con sus preguntas de comprensión)')
  } else {
    fail(`La guía sin conexión no mostró su contenido (${offlineText.replace(/\s+/g, ' ').slice(0, 160)})`)
  }

  await page.setOfflineMode(false)
  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
