#!/usr/bin/env node
// E2E: crossword answered offline, queued and synced when the connection returns
// (R-#242). It needs no service worker (the queue is IndexedDB + localStorage), so
// it also runs against a dev server:
//
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/offline-crossword.spec.mjs
//
// The wallet is the real `@learn-tg/pdj-wallet` core running in Node (R-#239).

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'
import { installCoreWalletMock, signInWithCoreWallet } from '../helpers/in-app-wallet.mjs'

// El crucigrama de una guía se resuelve leyendo el **Markdown local** de esa guía
// (las mismas respuestas que el servidor deriva desde 2026-09-22, R-#256 §3.4): antes
// había una lista fija de la guía 1 y cualquier cambio de guía o de pregunta rompía el
// spec. La guía la elige el spec entre las que todavía no pagaron las dos becas, porque
// el botón de envío se deshabilita, por diseño, una vez pagadas (R-#242).
const GUIDE_ORDER = { lang: 'en', prefix: 'gdcluster' }

/** Preguntas y respuestas del Markdown local de una guía (mismo formato que remark). */
function answersFromGuideFile(lang, prefix, suffix) {
  const file = path.join('..', '..', 'resources', lang, prefix, `${suffix}.md`)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const pairs = []
  let current = null
  const flush = () => {
    if (current === null) return
    const match = /^(.*___.*)\s+\(([^)]+)\)\s*$/s.exec(current.join('\n').trim())
    if (match) pairs.push({ clue: match[1].trim(), answer: match[2].trim() })
    current = null
  }
  for (const line of lines) {
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush()
      current = [line.replace(/^\s*\d+[.)]\s+/, '').replace(/\s+$/, '')]
    } else if (line.trim() === '' || /^\s*(#|```|---\s*$)/.test(line)) {
      flush()
    } else if (current !== null) {
      current.push(line.trim())
    }
  }
  flush()
  return pairs
}

function normalizeClue(text) {
  return String(text)
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/[_\-\—]/g, ' ')
    .trim()
    .toLowerCase()
}

function solveCrossword(grid, placements, pairs) {
  const solved = grid.map((row) => row.map((cell) => ({ ...cell, userInput: '' })))
  placements.forEach((placement) => {
    const normalized = normalizeClue(placement.clue)
    const pair = pairs.find((p) => normalizeClue(p.clue) === normalized)
    if (!pair) throw new Error(`No hay respuesta para la pista: ${String(placement.clue).slice(0, 80)}`)
    const { row, col, direction } = placement
    for (let i = 0; i < pair.answer.length; i++) {
      const r = direction === 'down' ? row + i : row
      const c = direction === 'across' ? col + i : col
      if (solved[r] && solved[r][c]) solved[r][c].userInput = pair.answer[i].toUpperCase()
    }
  })
  return solved
}

/** Llena las celdas con la solución (una por `evaluate`: React agrupa los eventos). */
async function fillSolved(page, solved) {
  const cells = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[data-row]')).map((el) => ({
      row: Number(el.getAttribute('data-row')),
      col: Number(el.getAttribute('data-col')),
    })),
  )
  let filled = 0
  for (const { row, col } of cells) {
    const letter = solved[row]?.[col]?.userInput
    if (!letter) continue
    await page
      .evaluate(({ r, c, l }) => {
        const el = document.querySelector(`input[data-row="${r}"][data-col="${c}"]`)
        if (!el) return
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        setter.call(el, l)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }, { r: row, c: col, l: letter })
      .catch(() => {})
    filled++
    await sleep(30)
  }
  return filled
}

const password = '12345678'

// Estado de la guía para el usuario (`guide_usuario.points` + beca en `transaction`):
// es la forma observable de "el servidor procesó la recompensa" (R-#242).
async function guideStatus(page, address, courseId, guideNumber) {
  return page.evaluate(async (path) => {
    const res = await fetch(path, { credentials: 'same-origin' })
    return res.ok ? res.json() : { error: `HTTP ${res.status}` }
  }, `/api/guide-status?courseId=${courseId}&guideNumber=${guideNumber}&walletAddress=${encodeURIComponent(address)}`)
}

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Reads the queue straight from IndexedDB (`learn-tg-offline` → `pending`). */
async function pendingInIndexedDb(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('learn-tg-offline')
        request.onerror = () => resolve(-1)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('pending')) {
            resolve(0)
            return
          }
          const count = db.transaction('pending', 'readonly').objectStore('pending').count()
          count.onsuccess = () => resolve(count.result)
          count.onerror = () => resolve(-1)
        }
      }),
  )
}

async function pendingCount(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="offline-pending"]')
    const match = el?.textContent?.match(/^\s*(\d+)/)
    return match ? Number(match[1]) : 0
  })
}

async function fillEveryCell(page) {
  // One cell per task: React batches the synthetic events of a single
  // `evaluate`, so filling them all at once left the grid with a single letter
  // and the submit button disabled.
  const count = await page.evaluate(() => document.querySelectorAll('input[data-row]').length)
  for (let index = 0; index < count; index++) {
    // A Fast Refresh on the dev server can reload the page mid-fill: ignore that
    // error and keep going with the cells of the new document.
    await page
      .evaluate((position) => {
        const cell = document.querySelectorAll('input[data-row]')[position]
        if (!cell) return
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        setter.call(cell, 'A')
        cell.dispatchEvent(new Event('input', { bubbles: true }))
      }, index)
      .catch(() => {})
    await sleep(40)
  }
  return count
}

async function clickSubmit(page) {
  const buttons = await page.$$('button')
  for (const button of buttons) {
    const text = ((await button.evaluate((el) => el.textContent)) || '').trim()
    if (/^(Submit answer|Enviar respuesta)$/.test(text)) {
      const disabled = await button.evaluate((el) => el.disabled)
      if (disabled) return false
      await button.click()
      return true
    }
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
  const { timeout, chainId } = env
  const { base } = resolveSiteTarget(env)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(120000)

  await installCoreWalletMock(page, { privateKey: creds.pk, address: creds.addr, chainId, password: password })
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await signInWithCoreWallet(page, { privateKey: creds.pk, address: creds.addr, chainId, baseUrl: base, password: password })
  ok('Signed in with the pdj-wallet core (session cookie)')

  // Se elige la guía cuyas dos becas **no** estén pagadas: una vez pagadas, el botón
  // de envío queda deshabilitado por diseño (R-#242) y no se podría verificar la cola.
  // La lectura puede fallar si la cookie de sesión aún no se propagó, así que se
  // reintenta: con `null` en todos los intentos se OMITE (nunca se falla por esto).
  async function readTargets() {
    return page.evaluate(async ({ prefix, lang }) => {
      const list = await (await fetch(`/api/course-catalog?filtro[busprefijoRuta]=/${prefix}&filtro[busidioma]=${lang}`, { credentials: 'same-origin' })).json()
      if (!Array.isArray(list) || list.length !== 1) return null
      const detail = await (await fetch(`/api/course-catalog/${list[0].id}`, { credentials: 'same-origin' })).json()
      return {
        courseId: Number(list[0].id),
        guides: (detail.guias || []).map((g) => g.sufijoRuta).filter(Boolean),
      }
    }, GUIDE_ORDER)
  }

  let targets = null
  let COURSE_ID = 0
  let guideNumber = 0
  let guideSuffix = null
  let authErrors = 0
  for (let attempt = 0; attempt < 3 && !guideNumber; attempt++) {
    targets = await readTargets()
    if (!targets || targets.guides.length === 0) {
      console.log('[SKIP] no se pudo leer el curso de prueba (/api/course-catalog)')
      await browser.close()
      process.exit(0)
    }
    COURSE_ID = targets.courseId
    // La cookie de sesión puede tardar un instante en llegar: se espera a que
    // `/api/guide-status` responda (es el mismo endpoint que autentica la página).
    let sessionReady = false
    for (let wait = 0; wait < 10 && !sessionReady; wait++) {
      const probe = await guideStatus(page, creds.addr, COURSE_ID, 1).catch(() => null)
      sessionReady = !!probe && !probe.error
      if (!sessionReady) await sleep(1500)
    }
    if (!sessionReady) continue
    authErrors = 0
    for (let index = 0; index < targets.guides.length; index++) {
      const status = await guideStatus(page, creds.addr, COURSE_ID, index + 1).catch(() => null)
      if (!status || status.error) { authErrors++; continue }
      if (status.receivedScholarship && status.receivedSlearnScholarship) continue
      // Además debe haber crucigrama: el sitio desplegado puede tener una copia de
      // `resources/` distinta de la de este árbol de trabajo (guías sin preguntas).
      const puzzle = await page.evaluate(async ({ prefix, lang, guide }) => {
        const res = await fetch(`/api/crossword?lang=${lang}&prefix=${prefix}&guide=${guide}`, { credentials: 'same-origin' })
        if (!res.ok) return 0
        const body = await res.json().catch(() => null)
        return (body?.placements || []).length
      }, { prefix: GUIDE_ORDER.prefix, lang: GUIDE_ORDER.lang, guide: targets.guides[index] })
      if (puzzle === 0) continue
      guideNumber = index + 1
      guideSuffix = targets.guides[index]
      break
    }
  }
  if (!guideNumber) {
    if (authErrors === (targets?.guides.length ?? 0)) {
      console.log('[SKIP] no se pudo autenticar contra /api/guide-status con la billetera de prueba (¿sitio sin desplegar o sesión SIWE no disponible?)')
    } else {
      console.log('[SKIP] ninguna guía de este curso sirve para la prueba: o ya pagó las dos becas (el botón se deshabilita por diseño) o el sitio desplegado no tiene su crucigrama. Usa otra billetera de prueba o despliega `resources/` actualizado.')
    }
    await browser.close()
    process.exit(0)
  }

  const guidePath = `/${GUIDE_ORDER.lang}/${GUIDE_ORDER.prefix}/${guideSuffix}/test`
  let pairs = []
  try {
    pairs = answersFromGuideFile(GUIDE_ORDER.lang, GUIDE_ORDER.prefix, guideSuffix)
  } catch (error) {
    console.log(`[SKIP] no se pudo leer el Markdown de la guía (${error.message})`)
    await browser.close()
    process.exit(0)
  }

  console.log(`\nCrossword offline | ${base}${guidePath} (guía ${guideNumber})\n`)

  // 1. Online: the puzzle loads and is stored in localStorage.
  // Se captura el crucigrama **que la página renderizó** (cada carga elige 3-5
  // preguntas al azar, así que un segundo request daría otro subconjunto y las
  // letras no corresponderían) y se borra el estado guardado de corridas anteriores
  // para que la entrega sea determinista.
  let puzzleData = null
  page.on('response', (r) => {
    if (puzzleData || !r.url().includes('/api/crossword')) return
    r.json().then((b) => { if (b && b.grid && b.placements) puzzleData = b }).catch(() => {})
  })
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('crossword-state-'))
      .forEach((k) => localStorage.removeItem(k))
  })
  // La primera carga puede tardar (el service worker se instala en un perfil nuevo y
  // el sitio de desarrollo compila en la primera petición): se reintenta una vez con
  // una recarga antes de darla por no disponible.
  let cells = []
  for (let attempt = 0; attempt < 2 && cells.length === 0; attempt++) {
    await page.goto(`${base}${guidePath}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[data-row]', { timeout: timeout * 2 }).catch(() => {})
    cells = await page.$$('input[data-row]')
    if (cells.length === 0 && attempt === 0) {
      console.log('  [i] sin cuadrícula todavía: recargando una vez')
      await sleep(3000)
    }
  }
  if (cells.length === 0) {
    console.log('[SKIP] el crucigrama de esa guía no está disponible (¿guía sin preguntas o sitio sin desplegar?)')
    await browser.close()
    process.exit(0)
  }
  ok(`Crossword rendered (${cells.length} cells)`)

  // Se resuelve con las respuestas de la guía y se llena con ellas (antes se llenaba
  // con 'A', así que la entrega siempre era incorrecta y la recompensa no se podía
  // verificar: R-#242).
  let solved = null
  if (puzzleData) {
    try {
      solved = solveCrossword(puzzleData.grid, puzzleData.placements, pairs)
    } catch (e) {
      fail(`No se pudo resolver el crucigrama: ${e.message}`)
    }
  } else {
    fail('No se capturó el crucigrama que renderizó la página (/api/crossword)')
  }

  // Estado de la guía **antes** de la entrega: si ya estaba completada, la
  // comprobación de recompensa de más abajo es más débil y hay que decirlo.
  const statusBefore = await guideStatus(page, creds.addr, COURSE_ID, guideNumber).catch(() => null)
  if (statusBefore && !statusBefore.error) {
    console.log(`  [antes] completada=${statusBefore.completed} becaUSDT=${statusBefore.receivedScholarship} becaSLEARN=${statusBefore.receivedSlearnScholarship}`)
  }

  const storageKey = await page.evaluate(() =>
    Object.keys(localStorage).find((key) => key.startsWith('crossword-state-')) || null,
  )

  // 2. Fill it (the submit button stays disabled until every cell has a letter).
  // Con la solución, si se pudo resolver: así el servidor marca la guía completada al
  // procesar el replay y la recompensa se puede verificar (R-#242).
  const filled = solved ? await fillSolved(page, solved) : await fillEveryCell(page)
  await sleep(500)
  ok(`Filled ${filled} cells${solved ? ' con la solución' : ' (relleno genérico)'}`)

  // 3. Offline: the page is already loaded, so no reload is needed. Without the
  // service worker of R-#240 an offline *reload* cannot work at all; what makes
  // the crossword usable offline is the localStorage copy of the puzzle.
  await page.setOfflineMode(true)
  await sleep(1000)
  const offlineKey = await page
    .evaluate(() =>
      Object.keys(localStorage).find((key) => key.startsWith('crossword-state-')) || null,
    )
    .catch(() => storageKey)
  if (offlineKey) ok(`Puzzle state kept in localStorage (${offlineKey})`)
  else if (storageKey) fail('The crossword state in localStorage was lost')
  else console.log('  [i] the state is written on the first edit; nothing to compare')

  // 4. Submitting offline must queue, not fail
  const submitted = await clickSubmit(page)
  if (!submitted) {
    // El botón se deshabilita, por diseño, cuando las dos becas de la guía ya se
    // pagaron (R-#242). La guía se eligió sin becas al inicio, así que llegar aquí
    // significa que el estado no es el esperado: se OMITE con el motivo a la vista
    // (`statusBefore` se leyó en línea, antes de desconectar).
    if (statusBefore?.receivedScholarship && statusBefore?.receivedSlearnScholarship) {
      console.log('[SKIP] las dos becas de esta guía ya están pagadas para esta billetera: el botón de envío queda deshabilitado por diseño.')
      await browser.close()
      process.exit(0)
    }
    fail('Submit button was disabled offline (puzzle not completed?)')
  } else {
    for (let i = 0; i < 10; i++) {
      await sleep(1000)
      if ((await pendingCount(page)) > 0) break
    }
    const pending = await pendingCount(page)
    if (pending > 0) ok(`Answer queued offline (pending indicator shows ${pending})`)
    else fail('No pending indicator after submitting offline')
  }

  // 5. The queue is in IndexedDB, not in memory: that is what makes it survive a
  // reload. (The page cannot be reloaded while offline: without the R-#240
  // service worker there is no cached HTML to load from.)
  const queuedInDb = await pendingInIndexedDb(page)
  if (queuedInDb > 0) ok(`Queue persisted in IndexedDB (${queuedInDb} pending)`)
  else fail(`The queued answer is not in IndexedDB (count ${queuedInDb})`)

  // 6. The queue is replayed (the page listens for `online`) y el servidor procesa la
  // entrega: es lo que exige R-#242 ("rewards processed after sync"). Se captura la
  // respuesta del replay para afirmarlo (antes solo se veía que la cola se vaciaba).
  const replayResponses = []
  let replayRequest = null
  page.on('request', (r) => {
    if (r.method() !== 'POST' || !r.url().includes('/api/check-crossword')) return
    try { replayRequest = r.postData() } catch { /* postData puede no estar disponible */ }
  })
  page.on('response', (r) => {
    if (!r.url().includes('/api/check-crossword')) return
    r.json().then((body) => replayResponses.push({ status: r.status(), body }))
      .catch(() => replayResponses.push({ status: r.status(), body: null }))
  })

  await page.setOfflineMode(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  let drained = 0
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    drained = await pendingCount(page)
    if (drained === 0) break
  }
  const dbAfterDrain = await pendingInIndexedDb(page)
  if (drained === 0 && dbAfterDrain === 0) {
    ok('Queue drained when the connection returned (indicator and IndexedDB empty)')
  } else {
    fail(`The queue still has ${drained} pending answer(s) (IndexedDB ${dbAfterDrain})`)
  }

  // 7. El replay fue **procesado por el servidor**: 200 y sin `error`. Si el servidor
  // no puede (cooldown, score, duplicado) igual responde 200 con un mensaje; lo que no
  // debe pasar es `error` ni quedarse en la cola (eso ya se verificó arriba).
  if (replayResponses.length === 0) {
    fail('No replay request to /api/check-crossword was observed')
  } else {
    const r = replayResponses[replayResponses.length - 1]
    if (r.status !== 200) {
      fail(`The replay was answered with HTTP ${r.status}`)
    } else if (r.body && r.body.error) {
      fail(`The replay was rejected by the server: ${JSON.stringify(r.body).slice(0, 140)}`)
    } else {
      const b = r.body || {}
      const usdt = Number(b.scholarshipUsdt || 0)
      const slearn = Number(b.scholarshipSlearn || 0)
      const reward = usdt > 0 || slearn > 0
        ? `beca pagada: ${usdt} USDT + ${slearn} SLEARN (tx ${String(b.scholarshipResult || '').slice(0, 10)}…)`
        : `sin beca nueva: ${JSON.stringify(b).slice(0, 200)}`
      ok(`El servidor procesó el replay (HTTP 200): ${reward}`)
      if (replayRequest) console.log(`  [replay body] ${String(replayRequest).slice(0, 200)}`)
    }
  }

  // 8. La recompensa quedó registrada para el usuario: la guía figura completada
  // (y con beca si era elegible). Es el otro lado del ítem de R-#242, más fuerte que
  // "la cola se vació".
  const statusAfter = await guideStatus(page, creds.addr, COURSE_ID, guideNumber).catch(() => null)
  if (!statusAfter || statusAfter.error) {
    fail(`No se pudo leer el estado de la guía tras el replay: ${JSON.stringify(statusAfter)}`)
  } else if (!statusAfter.completed) {
    fail(`La guía no quedó completada tras el replay (points=${statusAfter.points ?? '?'})`)
  } else {
    const wasCompleted = !!(statusBefore && statusBefore.completed)
    const newScholarship = !statusBefore?.receivedScholarship && statusAfter.receivedScholarship
    const newSlearn = !statusBefore?.receivedSlearnScholarship && statusAfter.receivedSlearnScholarship
    ok(`La recompensa quedó registrada: guía completada${wasCompleted ? ' (ya lo estaba antes)' : ' (pasó de pendiente a completada)'}`
      + `${newScholarship ? ' + beca USDT nueva' : ''}${newSlearn ? ' + beca SLEARN nueva' : ''}`)
  }

  const failures = summary(t0)
  await browser.close()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
