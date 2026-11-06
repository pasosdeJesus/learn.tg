// Completar guías por la interfaz: abre el crucigrama de la guía, lo resuelve con
// las respuestas del Markdown local y lo envía
// (https://github.com/pasosdeJesus/learn.tg/issues/161).
//
// El crédito de la guía (`guide_usuario.points = 1`) se otorga cuando el
// crucigrama queda correcto; no depende de que la bóveda del curso tenga fondos.

import { answersFromGuideFile, openCrosswordOnline, solveCrossword, fillSolved, clickSubmit, sleep } from './crossword.mjs'

/**
 * @param {import('puppeteer').Page} page
 * @param {string} base URL del sitio (sin barra final)
 * @param {{ lang: string, prefix: string, suffix: string }} guide
 */
export async function completeGuide(page, base, { lang, prefix, suffix }) {
  const url = `${base}/${lang}/${prefix}/${suffix}/test`
  const { puzzleData, cells, failure, fromStore } = await openCrosswordOnline(page, url, { timeout: 45000 })
  if (fromStore) {
    console.log(`  [nota] ${suffix}: crucigrama restaurado del dispositivo (la página no pidió /api/crossword)`)
  }
  if (!puzzleData) {
    // Por qué no hay crucigrama: el `code` del servidor (2026-11-05) o, si la página
    // no llegó a pedirlo, la ruta y el texto que mostraba (2026-11-06).
    let detail = 'sin respuesta de /api/crossword'
    if (failure?.code === 'no_request') {
      detail =
        `la página no pidió /api/crossword en ${failure.reason || '?'} ` +
        `(celdas ${failure.cells ?? 0}; guardado ${JSON.stringify(failure.stored ?? [])}): ` +
        String(failure.error || '').slice(0, 140)
    } else if (failure) {
      detail = `HTTP ${failure.status}${failure.code ? ` ${failure.code}` : ''}${
        failure.reason ? ` (${failure.reason})` : ''
      }${failure.error ? `: ${String(failure.error).slice(0, 140)}` : ''}`
    }
    throw new Error(`no apareció el crucigrama de ${lang}/${prefix}/${suffix} — ${detail}`)
  }
  if (cells === 0) throw new Error(`el crucigrama de ${suffix} no tiene celdas`)

  const pairs = answersFromGuideFile(lang, prefix, suffix)
  const solved = solveCrossword(puzzleData.grid, puzzleData.placements, pairs)
  await fillSolved(page, solved)

  // Guía ya pagada por completo (las dos becas): el botón de enviar queda
  // deshabilitado a propósito, no hay nada que ganar y no habrá respuesta de la API.
  // Antes eso se contaba como fallo y ensuciaba el resultado de la corrida (medido
  // 2026-11-06 con billeteras reutilizadas).
  const alreadyPaid = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((el) =>
      /^(Submit answer|Enviar respuesta)$/.test((el.textContent || '').trim()),
    )
    const text = document.body.innerText || ''
    return !!button?.disabled && /already been paid|ya ha sido pagada/i.test(text)
  })
  if (alreadyPaid) {
    return {
      accepted: true,
      alreadyPaid: true,
      cells,
      clues: puzzleData.placements.length,
      fromStore,
      text: 'la beca de esta guía ya está pagada: no hay nada que enviar',
    }
  }

  // El resultado se lee de la **respuesta de la API**, no del texto de la página: así
  // "la guía quedó contada" (points=1) no se confunde con una beca pendiente (F-#295)
  // ni con un error de red, y el reintento sabe qué pasó.
  const submissions = []
  const onResponse = (response) => {
    if (!response.url().includes('/api/check-crossword')) return
    const entry = { status: response.status(), body: null }
    submissions.push(entry)
    response.json().then((body) => { entry.body = body }).catch(() => {})
  }
  page.on('response', onResponse)

  await clickSubmit(page)

  // Hasta 60 s: la entrega incluye la cadena (beca y 10% del clúster).
  let outcome = null
  for (let attempt = 0; attempt < 60 && !outcome; attempt++) {
    await sleep(1000)
    const done = submissions.find((entry) => entry.body)
    if (done) outcome = done
  }
  page.off('response', onResponse)

  let text = await page.evaluate(() => document.body.innerText.replace(/s+/g, ' '))
  await sleep(1000)
  if (!text) text = ''

  if (!outcome) {
    // Sin respuesta: o la página no llegó a enviar (botón deshabilitado) o la petición
    // se quedó sin contestar. El texto de la página dice cuál de las dos.
    const stillSending = /sending|enviando/i.test(text)
    return {
      accepted: false,
      cells,
      clues: puzzleData.placements.length,
      text: text.slice(0, 200),
      error: stillSending ? 'la petición no respondió en 60 s' : 'no hubo respuesta de /api/check-crossword',
    }
  }

  const body = outcome.body || {}
  return {
    accepted: outcome.status === 200 && Number(body.points) === 1,
    cells,
    clues: puzzleData.placements.length,
    text: text.slice(0, 200),
    status: outcome.status,
    points: body.points,
    scholarship: body.scholarship,
    mistakes: body.mistakesInCW,
    ...(outcome.status === 200
      ? {}
      : { error: `HTTP ${outcome.status}: ${String(body.error || body.message || '').slice(0, 140)}` }),
  }
}

/**
 * Completa las guías indicadas en orden y devuelve el resumen por guía.
 * Un fallo en una guía no detiene las demás: se informa en el resultado.
 */
export async function completeGuides(page, base, { lang, prefix, suffixes }) {
  const results = []
  for (const suffix of suffixes) {
    let result = { suffix, accepted: false, error: 'sin intento' }
    // Tres intentos: con la beca pagándose la entrega tarda más y alguna guía se
    // pierde bajo carga (la spec del clúster necesita las seis de cada pastor).
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const attemptResult = { suffix, ...(await completeGuide(page, base, { lang, prefix, suffix })) }
        result = attemptResult
        if (attemptResult.accepted) break
      } catch (error) {
        result = { suffix, accepted: false, error: error instanceof Error ? error.message : String(error) }
      }
      // La primera guía de una corrida llega con la ruta fría en el sitio de desarrollo:
      // se le da más aire antes del reintento.
      await sleep(attempt === 0 ? 10000 : 3000)
    }
    if (result.alreadyPaid) {
      console.log(`  [nota] ${suffix}: la beca ya estaba pagada, no hay nada que enviar`)
    }
    results.push(result)
    await sleep(1500)
  }
  return results
}
