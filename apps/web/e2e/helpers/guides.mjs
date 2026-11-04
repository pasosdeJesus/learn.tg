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
  const { puzzleData, cells } = await openCrosswordOnline(page, url, { timeout: 45000 })
  if (!puzzleData) throw new Error(`no apareció el crucigrama de ${lang}/${prefix}/${suffix}`)
  if (cells === 0) throw new Error(`el crucigrama de ${suffix} no tiene celdas`)

  const pairs = answersFromGuideFile(lang, prefix, suffix)
  const solved = solveCrossword(puzzleData.grid, puzzleData.placements, pairs)
  await fillSolved(page, solved)
  await clickSubmit(page)

  // El envío es asíncrono (la página muestra "Sending..."): se espera el resultado
  // hasta 45 s en vez de un tiempo fijo.
  let text = ''
  let accepted = false
  for (let attempt = 0; attempt < 45; attempt++) {
    await sleep(1000)
    text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
    if (/sending|enviando/i.test(text)) continue
    if (/correct|correcta|bien hecho|well done|aciertos|incorrect|incorrecta/i.test(text)) {
      accepted = /correct|correcta|bien hecho|well done|aciertos/i.test(text)
      break
    }
  }
  await sleep(1500)
  return { accepted, cells, clues: puzzleData.placements.length, text: text.slice(0, 200) }
}

/**
 * Completa las guías indicadas en orden y devuelve el resumen por guía.
 * Un fallo en una guía no detiene las demás: se informa en el resultado.
 */
export async function completeGuides(page, base, { lang, prefix, suffixes }) {
  const results = []
  for (const suffix of suffixes) {
    let result = { suffix, accepted: false, error: 'sin intento' }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const attemptResult = { suffix, ...(await completeGuide(page, base, { lang, prefix, suffix })) }
        result = attemptResult
        if (attemptResult.accepted) break
      } catch (error) {
        result = { suffix, accepted: false, error: error instanceof Error ? error.message : String(error) }
      }
      await sleep(3000)
    }
    results.push(result)
    await sleep(1500)
  }
  return results
}
