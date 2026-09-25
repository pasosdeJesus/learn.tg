// Ayudantes compartidos por los specs de crucigrama sin conexión
// (https://github.com/pasosdeJesus/learn.tg/issues/242): resolver el crucigrama que
// la página renderizó leyendo las respuestas del Markdown local de la guía (la misma
// fuente que el servidor deriva desde R-#256 §3.4), rellenar las celdas, leer la cola
// de `learn-tg-offline` y pulsar el botón de envío.
//
// Nacieron duplicados en `offline-crossword.spec.mjs`; se extraen aquí para que el
// spec de dos cursos (`offline-two-courses.spec.mjs`) use exactamente el mismo criterio.

import * as fs from 'fs'
import * as path from 'path'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Preguntas y respuestas del Markdown local de una guía (mismo formato que remark). */
export function answersFromGuideFile(lang, prefix, suffix) {
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

export function normalizeClue(text) {
  return String(text)
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/[_\-\—]/g, ' ')
    .trim()
    .toLowerCase()
}

/** Devuelve la cuadrícula con las letras de la solución (según el Markdown local). */
export function solveCrossword(grid, placements, pairs) {
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
export async function fillSolved(page, solved) {
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

/** Lee la cola directamente de IndexedDB (`learn-tg-offline` → `pending`). */
export async function pendingInIndexedDb(page) {
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

/** Contador que ve el estudiante (`data-testid="offline-pending"`). */
export async function pendingCount(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="offline-pending"]')
    const match = el?.textContent?.match(/^\s*(\d+)/)
    return match ? Number(match[1]) : 0
  })
}

/**
 * Pulsa "Enviar respuesta" si está habilitado. Devuelve `false` si no se pudo.
 *
 * Se resuelve con **un solo `evaluate`** (y un `click()` del DOM, que React atiende
 * igual): con `page.$$('button')` más un `evaluate` por botón, un `evaluate` colgado deja
 * el spec esperando el timeout de protocolo sin decir en qué botón (medido 2026-09-25
 * contra el sitio de desarrollo).
 */
export async function clickSubmit(page) {
  return page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((el) =>
      /^(Submit answer|Enviar respuesta)$/.test((el.textContent || '').trim()),
    )
    if (!button) return false
    if (button.disabled) return false
    button.click()
    return true
  })
}

/**
 * Diagnóstico del envío (R-#242): cuántas celdas hay, cuántas tienen letra y qué
 * botones existen con su estado. Se imprime cuando el botón de envío no se puede
 * pulsar, para distinguir "la cuadrícula se vació" de "el botón no está".
 */
export async function submitDiagnostics(page) {
  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('input[data-row]'))
    return {
      cells: cells.length,
      filled: cells.filter((el) => (el.value || '') !== '').length,
      buttons: Array.from(document.querySelectorAll('button')).map(
        (el) => `${(el.textContent || '').trim().slice(0, 24)}${el.disabled ? ' [disabled]' : ''}`,
      ),
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
    }
  })
}

/**
 * Abre la página del crucigrama en línea, espera la cuadrícula y devuelve el
 * crucigrama **que la página renderizó** (cada carga elige 3-5 preguntas al azar,
 * así que hay que usar ese y no uno nuevo).
 */
export async function openCrosswordOnline(page, url, { timeout = 30000 } = {}) {
  let puzzleData = null
  const capture = (response) => {
    if (puzzleData || !response.url().includes('/api/crossword')) return
    response.json().then((body) => {
      if (body && body.grid && body.placements) puzzleData = body
    }).catch(() => {})
  }
  page.on('response', capture)

  let cells = []
  for (let attempt = 0; attempt < 2 && cells.length === 0; attempt++) {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[data-row]', { timeout: timeout * 2 }).catch(() => {})
    cells = await page.$$('input[data-row]')
    if (cells.length === 0 && attempt === 0) await sleep(3000)
  }
  page.off('response', capture)
  return { cells: cells.length, puzzleData }
}
