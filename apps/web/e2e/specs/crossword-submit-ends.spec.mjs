#!/usr/bin/env node
// E2E: a crossword submission always ends and the response says what happened
// (F-#295, https://github.com/pasosdeJesus/learn.tg/issues/295).
//
// What it checks against the dev site, through the UI and with the real chain
// behind the server:
//
//   1. a WRONG answer answers `200` with `points: 0` and `scholarship: 'not_paid'`,
//      and the button leaves "Sending..." within the budget;
//   2. a CORRECT answer answers `200` with `points: 1` and `scholarship` in the
//      four states of the requirement (`paid`, `already_paid`, `pending`,
//      `not_paid`), also within the budget.
//
// The "RPC unreachable" case (guide credited, `scholarship: 'pending'` in a few
// seconds) cannot be forced from here: the RPC is the server's, not the
// browser's. It is covered by the engine test
// `packages/rewards/src/routes/__tests__/check-crossword.test.ts`, which injects
// a chain that never answers.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     CHAIN_ID=11142220 node e2e/specs/crossword-submit-ends.spec.mjs
//
// Override the courses with `CROSSWORD_COURSES="en/web3-and-ubi,en/a-relationship-with-Jesus"`
// and the budget with `SUBMIT_BUDGET_MS`.

import { fail, initTestEnv, launchBrowser, ok, resetFailures, resolveSiteTarget, setupFullWalletMock, summary } from '@pasosdejesus/m/e2e'
import { loadSelectedWallet } from '../helpers/e2e-wallet.mjs'
import { signInWithCoreWallet } from '../helpers/in-app-wallet.mjs'
import {
  answersFromGuideFile, clickSubmit, fillSolved, openCrosswordOnline, sleep, solveCrossword, submitDiagnostics,
} from '../helpers/crossword.mjs'

// The test wallet has already paid both scholarships of several guides (the
// submit button is disabled by design once they are paid, R-#242), and the
// deployed `resources/` copy decides which crosswords exist, so the spec looks
// for a guide that can still be submitted across these courses.
const COURSES = (process.env.CROSSWORD_COURSES || 'en/web3-and-ubi,en/a-relationship-with-Jesus,en/gdcluster')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    const [lang, prefix] = value.split('/')
    return { lang, prefix }
  })
const BUDGET_MS = Number(process.env.SUBMIT_BUDGET_MS || 45000)

const SCHOLARSHIP_STATES = ['paid', 'already_paid', 'pending', 'not_paid']

/** Captures every `/api/check-crossword` answer with its status and arrival time. */
function captureSubmissions(page) {
  const entries = []
  const onResponse = (response) => {
    if (!response.url().includes('/api/check-crossword')) return
    const entry = { status: response.status(), arrivedAt: Date.now(), body: null }
    entries.push(entry)
    response
      .json()
      .then((body) => {
        entry.body = body
        entry.parsedAt = Date.now()
      })
      .catch(() => {
        entry.body = null
      })
  }
  page.on('response', onResponse)
  return { entries, stop: () => page.off('response', onResponse) }
}

async function waitForSubmission(capture, { since, count, budget }) {
  const deadline = since + budget
  while (Date.now() < deadline) {
    const done = capture.entries.filter((entry) => entry.body)
    if (done.length >= count) return done[done.length - 1]
    await sleep(500)
  }
  return null
}

/** The page is no longer sending: the button no longer reads "Sending...". */
async function waitForSettled(page, { since, budget }) {
  const deadline = since + budget
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find((el) =>
        /^(Submit answer|Enviar respuesta|Sending\.\.\.|Enviando\.\.\.)$/.test((el.textContent || '').trim()),
      )
      return {
        sending: /^(Sending\.\.\.|Enviando\.\.\.)$/.test((button?.textContent || '').trim()),
        text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 240),
      }
    })
    if (!state.sending) return { settledAt: Date.now(), text: state.text }
    await sleep(250)
  }
  return null
}

/** Fills one cell with a letter the solution does not have there. */
async function breakOneCell(page, solved) {
  return page.evaluate((solution) => {
    const inputs = Array.from(document.querySelectorAll('input[data-row]'))
    for (const input of inputs) {
      const row = Number(input.getAttribute('data-row'))
      const col = Number(input.getAttribute('data-col'))
      const expected = solution?.[row]?.[col]?.userInput
      if (!expected) continue
      const wrong = expected === 'A' ? 'B' : 'A'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter.call(input, wrong)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return { row, col, wrong }
    }
    return null
  }, solved)
}

async function restoreCell(page, { row, col }, solved) {
  const letter = solved?.[row]?.[col]?.userInput
  return page.evaluate(({ r, c, l }) => {
    const input = document.querySelector(`input[data-row="${r}"][data-col="${c}"]`)
    if (!input || !l) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter.call(input, l)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, { r: row, c: col, l: letter })
}

async function submitEnabled(page) {
  return page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((el) =>
      /^(Submit answer|Enviar respuesta)$/.test((el.textContent || '').trim()),
    )
    return !!button && !button.disabled
  })
}

/**
 * Guides of a course with their status for this wallet. A guide whose two
 * scholarships are already paid disables the submit button, so it is skipped
 * before opening the crossword.
 */
async function guidesOf(page, wallet, { lang, prefix }) {
  return page.evaluate(
    async ({ lang, prefix }) => {
      const list = await (
        await fetch(`/api/course-catalog?filtro[busprefijoRuta]=/${prefix}&filtro[busidioma]=${lang}`, {
          credentials: 'same-origin',
        })
      ).json()
      if (!Array.isArray(list) || list.length !== 1) return null
      const detail = await (await fetch(`/api/course-catalog/${list[0].id}`, { credentials: 'same-origin' })).json()
      return {
        courseId: Number(list[0].id),
        guides: (detail.guias || []).map((guide) => guide.sufijoRuta).filter(Boolean),
      }
    },
    { lang, prefix },
  )
}

async function guideStatus(page, wallet, courseId, guideNumber) {
  return page.evaluate(
    async (path) => {
      const res = await fetch(path, { credentials: 'same-origin' })
      return res.ok ? res.json() : { error: `HTTP ${res.status}` }
    },
    `/api/guide-status?courseId=${courseId}&guideNumber=${guideNumber}&walletAddress=${encodeURIComponent(wallet)}`,
  )
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const wallet = loadSelectedWallet()
  if (!wallet) {
    console.error('No credentials found in apps/.env')
    process.exit(1)
  }

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { chainId } = env
  const { base } = resolveSiteTarget(env)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(120000)

  await setupFullWalletMock(page, { privateKey: wallet.pk, address: wallet.addr, chainId })
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await signInWithCoreWallet(page, { privateKey: wallet.pk, address: wallet.addr, chainId, baseUrl: base })
  ok('sesión iniciada con la billetera de prueba')

  // ── Find a guide that can be submitted ────────────────────────────────────
  let target = null
  for (const course of COURSES) {
    const info = await guidesOf(page, wallet.addr, course).catch(() => null)
    if (!info || !info.guides.length) {
      console.log(`  [skip] ${course.lang}/${course.prefix}: no se pudo leer el curso`)
      continue
    }
    let found = null
    for (let index = 0; index < info.guides.length && !found; index++) {
      const status = await guideStatus(page, wallet.addr, info.courseId, index + 1).catch(() => null)
      if (!status || status.error) continue
      if (status.receivedScholarship && status.receivedSlearnScholarship) continue
      found = { suffix: info.guides[index], guideNumber: index + 1 }
    }
    if (found) {
      target = { ...course, ...found, courseId: info.courseId, path: `/${course.lang}/${course.prefix}/${found.suffix}/test` }
      break
    }
    console.log(`  [skip] ${course.lang}/${course.prefix}: todas sus guías ya pagaron las dos becas para esta billetera`)
  }

  if (!target) {
    console.log('[SKIP] ninguna guía de las configuradas sirve para la prueba (sin crucigrama o ya pagada).')
    await browser.close()
    process.exit(0)
  }

  const { puzzleData, cells } = await openCrosswordOnline(page, `${base}${target.path}`, { timeout: 45000 })
  if (!puzzleData || cells === 0) {
    console.log(`[SKIP] el sitio no sirve el crucigrama de ${target.path}.`)
    await browser.close()
    process.exit(0)
  }

  let pairs
  try {
    pairs = answersFromGuideFile(target.lang, target.prefix, target.suffix)
  } catch (error) {
    console.log(`[SKIP] no se pudo leer el Markdown de la guía (${error.message}).`)
    await browser.close()
    process.exit(0)
  }

  const solved = solveCrossword(puzzleData.grid, puzzleData.placements, pairs)
  const filled = await fillSolved(page, solved)
  await sleep(500)
  if (!(await submitEnabled(page))) {
    console.log(`[SKIP] el botón de envío quedó deshabilitado en ${target.path} (¿las dos becas pagadas?).`)
    await browser.close()
    process.exit(0)
  }

  console.log(`\nF-#295 | ${base}${target.path} (guía ${target.guideNumber}, ${puzzleData.placements.length} pistas, ${filled} celdas)\n`)

  const capture = captureSubmissions(page)

  // ── 1. Wrong answer: 200, no credit, no payment, and the button ends ──────
  {
    const broken = await breakOneCell(page, solved)
    if (!broken) {
      fail('no se pudo escribir una respuesta incorrecta')
    } else {
      const clickedAt = Date.now()
      if (!(await clickSubmit(page))) {
        fail('el botón de envío no aceptó el clic')
        const diagnostics = await submitDiagnostics(page)
        console.log(`  [diagnóstico] ${JSON.stringify(diagnostics)}`)
      } else {
        const entry = await waitForSubmission(capture, { since: clickedAt, count: 1, budget: BUDGET_MS })
        const settled = await waitForSettled(page, { since: clickedAt, budget: BUDGET_MS })
        const elapsed = entry ? entry.arrivedAt - clickedAt : null

        if (!entry) {
          fail(`la respuesta incorrecta no obtuvo respuesta del servidor en ${BUDGET_MS} ms (la petición quedó colgada)`)
        } else if (entry.status !== 200) {
          fail(`la respuesta incorrecta devolvió HTTP ${entry.status}`)
        } else {
          if (entry.body?.points === 0) ok('respuesta incorrecta: points = 0')
          else fail(`respuesta incorrecta: se esperaba points = 0 y llegó ${JSON.stringify(entry.body?.points)}`)
          if (entry.body?.scholarship === 'not_paid') ok("respuesta incorrecta: scholarship = 'not_paid'")
          else fail(`respuesta incorrecta: scholarship = ${JSON.stringify(entry.body?.scholarship)}`)
          ok(`respuesta incorrecta atendida en ${elapsed} ms`)
        }
        if (settled) ok(`${settled.settledAt - clickedAt} ms después el botón ya no dice "Sending..."`)
        else fail(`el botón siguió en "Sending..." más de ${BUDGET_MS} ms`)
      }
      await restoreCell(page, broken, solved)
      await sleep(400)
    }
  }

  // ── 2. Correct answer: 200, guide credited and scholarship reported ───────
  {
    const before = capture.entries.length
    const clickedAt = Date.now()
    if (!(await clickSubmit(page))) {
      fail('el botón de envío no aceptó el segundo clic (¿quedó deshabilitado?)')
      const diagnostics = await submitDiagnostics(page)
      console.log(`  [diagnóstico] ${JSON.stringify(diagnostics)}`)
    } else {
      const entry = await waitForSubmission(capture, { since: clickedAt, count: before + 1, budget: BUDGET_MS })
      const settled = await waitForSettled(page, { since: clickedAt, budget: BUDGET_MS })
      const elapsed = entry ? entry.arrivedAt - clickedAt : null
      const newEntries = capture.entries.length - before

      if (newEntries === 0) {
        fail(`la respuesta correcta no obtuvo respuesta del servidor en ${BUDGET_MS} ms`)
      } else if (!entry) {
        fail('la respuesta correcta no llegó completa dentro del presupuesto')
      } else if (entry.status !== 200) {
        fail(`la respuesta correcta devolvió HTTP ${entry.status}`)
      } else {
        const body = entry.body || {}
        if (body.points === 1) ok('respuesta correcta: points = 1 (la guía quedó contada)')
        else fail(`respuesta correcta: se esperaba points = 1 y llegó ${JSON.stringify(body.points)}`)

        if (SCHOLARSHIP_STATES.includes(body.scholarship)) {
          ok(`respuesta correcta: scholarship = '${body.scholarship}'`)
          if (body.scholarship === 'paid') {
            ok(`beca pagada: ${body.scholarshipUsdt} USDT y ${body.scholarshipSlearn} SLEARN`)
          } else if (body.scholarship === 'pending') {
            ok('beca pendiente: el servidor respondió igual y la guía está contada (se reintentará)')
          } else if (body.scholarship === 'already_paid') {
            ok('beca ya pagada en otra billetera de la cuenta o en un envío anterior')
          } else {
            ok(`sin beca en este envío (${String(body.message || '').slice(0, 120)})`)
          }
        } else {
          fail(`respuesta correcta: scholarship ausente o inválido (${JSON.stringify(body.scholarship)})`)
        }
        ok(`respuesta correcta atendida en ${elapsed} ms`)
      }
      if (settled) ok(`${settled.settledAt - clickedAt} ms después el botón ya no dice "Sending..."`)
      else fail(`el botón siguió en "Sending..." más de ${BUDGET_MS} ms`)
    }
  }

  capture.stop()
  await browser.close()
  console.log(`\nDuración: ${((performance.now() - t0) / 1000).toFixed(1)}s`)
  summary(t0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
