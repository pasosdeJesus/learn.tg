#!/usr/bin/env node
// E2E: descarga completa de un curso y lectura sin conexión de una guía que
// nunca se abrió en línea (https://github.com/pasosdeJesus/learn.tg/issues/256).
//
// Curso de prueba: `/en/web3-and-ubi` — gratuito y **sin** contenido sensible
// (así no depende del interruptor de privacidad de R-#259; un curso sensible
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
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'
import { installCoreWalletMock, signInWithCoreWallet } from '../helpers/in-app-wallet.mjs'

const COURSE_PATH = '/en/web3-and-ubi'
const NEVER_VISITED_PATH = '/en/web3-and-ubi/guide4'
const READY_TEXT = 'You can read this course without a connection'
const password = '12345678'

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
  const { timeout, chainId } = env
  const { base } = resolveSiteTarget(env)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(120000)

  // R-#256: la descarga guarda también el crucigrama del curso, y `/api/crossword`
  // exige **sesión**: sin ella responde 200 con la cuadrícula vacía y "conecta tu
  // billetera", así que el crucigrama guardado quedaba sin celdas y esa mitad del
  // spec no se podía verificar (medido 2026-09-24 en el sitio de desarrollo). Se
  // ingresa como lo haría el estudiante.
  await installCoreWalletMock(page, { privateKey: creds.pk, address: creds.addr, chainId, password })
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await signInWithCoreWallet(page, { privateKey: creds.pk, address: creds.addr, chainId, baseUrl: base, password })
  ok('Signed in with the pdj-wallet core (session cookie)')

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

  // 2. La sincronización del curso (§3.2), **automática**: no hay botón de descarga
  // (decisión del operador, 2026-09-23); al abrir el curso con conexión se guarda
  // solo. Se espera a que la página lo confirme; si no llega, la función no está
  // desplegada todavía.
  try {
    await page.waitForFunction(
      (text) => (document.body?.innerText || '').includes(text),
      { timeout: Math.max(timeout, 180000) },
      READY_TEXT,
    )
    ok('El curso quedó guardado sin pulsar nada (la página lo confirma)')
  } catch {
    const hasPanel = await page.$('[data-testid="offline-course-download"]')
    if (!hasPanel) {
      console.log('[SKIP] no está el panel de descarga del curso — R-#256 no está desplegada todavía')
      await browser.close()
      process.exit(0)
    }
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

  // Un crucigrama **sin pistas** no se guarda (R-#256): sirve para elegir la guía de
  // la comprobación sin conexión y para omitir el spec con un motivo claro cuando el
  // despliegue no sirve crucigramas de este curso.
  const guidesWithPuzzle = (stored?.record?.guides ?? [])
    .filter((guide) => (guide.puzzle?.placements ?? []).length > 0)
  if (guidesWithPuzzle.length > 0) ok(`El curso trae ${guidesWithPuzzle.length} crucigrama(s) con pistas`)
  else console.log('  [i] el curso descargado no trae crucigramas con pistas')

  if ((stored?.guideKeys ?? []).some((key) => key === 'en/web3-and-ubi/guide4')) {
    ok('La guía nunca visitada quedó guardada con su contenido')
  } else {
    fail(`No se guardó el contenido de la guía nunca visitada (${(stored?.guideKeys ?? []).join(', ')})`)
  }

  // 4. Sin conexión, abrir la guía nunca visitada.
  //
  // El HTML de Next trae `Vary: rsc, next-router-state-tree, …`, así que la caché
  // solo acierta si la regla `/(en|es)/*` usa `matchOptions.ignoreVary` (R-#256).
  // Eso se comprueba en el worker **desplegado** (`/sw.js`), no en la respuesta
  // cacheada (que siempre trae `Vary`): si falta, la navegación cae en `/offline` y
  // se OMITE con el motivo exacto en vez de fallar por un despliegue viejo.
  if (!/ignoreVary/.test(swSource)) {
    console.log('[SKIP] el worker desplegado no declara `matchOptions.ignoreVary` en la regla `/(en|es)/*` de `next.config.ts`: sin eso la navegación sin conexión no acierta en la caché (cae en /offline). Recompila y reinicia el sitio con este árbol para verificar la lectura offline de una guía nunca visitada.')
    await browser.close()
    process.exit(0)
  }

  await page.setOfflineMode(true)

  // 3b. R-#256 §3.10: la página del **curso** tampoco queda vacía sin conexión: la copia
  // guarda la presentación (subtítulo + introducción) y el avance del momento de la
  // descarga, con su fecha, y no ofrece las acciones que dependen de la cadena.
  try {
    await page.goto(`${base}${COURSE_PATH}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => !!document.querySelector('[data-testid="offline-progress"]'),
      { timeout: 30000 },
    )
    const courseOffline = await page.evaluate(() => ({
      progress: (document.querySelector('[data-testid="offline-progress"]')?.textContent || '').trim(),
      characters: (document.body?.innerText || '').length,
      chainNotice: !!document.querySelector('[data-testid="offline-chain-actions"]'),
    }))
    if (/Progress as of \d/.test(courseOffline.progress)) {
      ok(`La página del curso sin conexión muestra el avance guardado (${courseOffline.progress})`)
    } else {
      fail(`La página del curso sin conexión no mostró el avance guardado (${courseOffline.progress})`)
    }
    if (courseOffline.characters > 400) ok(`La página del curso sin conexión no quedó vacía (${courseOffline.characters} caracteres)`)
    else fail(`La página del curso sin conexión quedó vacía (${courseOffline.characters} caracteres)`)
    if (courseOffline.chainNotice) ok('Sin conexión no se ofrecen donar ni UBI (se explica el motivo)')
    else fail('Sin conexión la página del curso no advirtió que donar/UBI necesitan conexión')
  } catch (error) {
    // Un tiempo de espera agotado no dice qué se vio: sin este volcado, "Waiting failed"
    // no distingue entre la página de respaldo `/offline`, una página vacía o un panel
    // que no se pintó por no considerarse la copia como legible (E2E 2026-09-25).
    const diagnostics = await page.evaluate(() => ({
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 180),
      downloadPanel: !!document.querySelector('[data-testid="offline-course-download"]'),
      chainNotice: !!document.querySelector('[data-testid="offline-chain-actions"]'),
      testids: [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')).slice(0, 25),
    })).catch(() => null)
    console.log(`  [diagnóstico] ${JSON.stringify(diagnostics)}`)
    fail(`La página del curso sin conexión falló: ${error.message}`)
  }

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

  // La página de respaldo (`app/offline/page.tsx`) se reconoce por su frase propia,
  // **no** por "You are offline": ese texto también está en el banner de cada página
  // (`components/OfflineBanner.tsx`) y confundirlo hacía fallar el spec aunque la
  // guía se leyera bien (la guía sin conexión muestra "Showing the saved copy").
  const isFallback = /Your progress is saved and will sync when the connection returns/.test(offlineText)
  const looksLikeGuide = /Showing the saved copy|Comprehension Questions|Introduction/.test(offlineText)
  if (isFallback) {
    fail('Sin conexión se sirvió la página de respaldo /offline en vez de la guía descargada')
  } else if (looksLikeGuide) {
    ok('La guía nunca visitada se lee sin conexión (desde la copia guardada)')
  } else {
    fail(`La guía sin conexión no mostró su contenido (${offlineText.replace(/\s+/g, ' ').slice(0, 160)})`)
  }

  // 5. Y su **crucigrama** también: la página `/test` usa el crucigrama descargado
  // cuando `GET /api/crossword` no responde (el operador reportó el 2026-09-23 que
  // el puzzle descargado caía en "You are offline").
  //
  // Se usa una guía cuyo crucigrama **sí** se descargó (con pistas): un despliegue que
  // no sirve crucigramas de este curso no permite verificar esta mitad, así que se
  // OMITE con el motivo en vez de fallar.
  if (guidesWithPuzzle.length === 0) {
    console.log('[SKIP] el curso descargado no trae ningún crucigrama con pistas (el sitio no sirve crucigramas para estas guías): la lectura del crucigrama sin conexión no se puede verificar aquí.')
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }
  const CROSSWORD_PATH = `${COURSE_PATH}/${guidesWithPuzzle[0].suffix}/test`

  // Esa página necesita su propio documento en caché; la descarga lo calienta desde
  // el 2026-09-23. Si el despliegue es anterior, se OMITE con el motivo en vez de
  // fallar por una versión vieja del sitio.
  const testPageCached = await page.evaluate(async (path) => {
    try {
      const cache = await window.caches.open('learntg-pages')
      return !!(await cache.match(path))
    } catch {
      return false
    }
  }, CROSSWORD_PATH)
  if (!testPageCached) {
    console.log('[SKIP] el despliegue no calienta la página del crucigrama (`/test`) al descargar el curso: falta desplegar el cambio del 2026-09-23 para verificar que el puzzle descargado abre sin conexión.')
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }

  try {
    await page.goto(`${base}${CROSSWORD_PATH}`, { waitUntil: 'domcontentloaded' })
  } catch (error) {
    console.log(`  [!] La navegación sin conexión al crucigrama falló: ${error.message}`)
  }
  let puzzleState = { cells: 0, text: '' }
  try {
    await page.waitForSelector('input[data-row]', { timeout: 30000 })
    puzzleState = await page.evaluate(() => ({
      cells: document.querySelectorAll('input[data-row]').length,
      text: document.body.innerText,
    }))
  } catch {
    puzzleState = await page.evaluate(() => ({
      cells: document.querySelectorAll('input[data-row]').length,
      text: document.body?.innerText || '',
    }))
  }

  if (/Your progress is saved and will sync when the connection returns/.test(puzzleState.text)) {
    fail('Sin conexión el crucigrama descargado mostró la página de respaldo /offline')
  } else if (puzzleState.cells > 0) {
    ok(`El crucigrama descargado se abre sin conexión (${puzzleState.cells} celdas)`)
  } else {
    fail(`El crucigrama descargado no se abrió sin conexión (${puzzleState.text.replace(/\s+/g, ' ').slice(0, 160)})`)
  }

  await page.setOfflineMode(false)
  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
