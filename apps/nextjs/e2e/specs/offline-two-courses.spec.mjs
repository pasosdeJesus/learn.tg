#!/usr/bin/env node
// E2E: dos cursos distintos, sin conexión, con una **billetera nueva**
// (https://github.com/pasosdeJesus/learn.tg/issues/242).
//
// Qué comprueba, con una billetera creada por el propio spec (no una preparada a mano):
//   1. inicia sesión por SIWE — eso la registra en `billetera_usuario`;
//   2. el spec la lleva a `profilescore >= 50` (perfil del dueño + los campos que
//      confirma el verificador), que es el mínimo que exige el contrato para pagar beca;
//   3. **en línea** carga las guías y los crucigramas de **dos cursos diferentes**;
//   4. **sin conexión** envía los dos crucigramas: quedan en la cola (`learn-tg-offline`);
//   5. al volver la conexión la cola se drena y **los dos cursos pagan beca**.
//
// El punto 5 es la regresión que se quiere fijar: el enfriamiento del contrato es **por
// curso** (`studentCooldowns[courseId][student]` en LearnTGVaultsV5), así que enviar en
// el curso A no puede impedir el pago del curso B dentro de las mismas 24 h.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/offline-two-courses.spec.mjs
//
// La billetera que inicia sesión como **verificador** es la de `apps/.env`
// (`PRIVATE_KEY`/`NEXT_PUBLIC_ADDRESS`); en el sitio de desarrollo es la misma
// (`NEXT_PUBLIC_VERIFIER_WALLET`). Sin ella el spec se OMITE: no puede confirmar los
// campos que dan los puntos de perfil.

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'
import {
  createTestWallet, installCoreWalletMock, signInWithCoreWallet,
} from '../helpers/in-app-wallet.mjs'
import {
  answersFromGuideFile, clickSubmit, fillSolved, openCrosswordOnline,
  pendingCount, pendingInIndexedDb, sleep, solveCrossword, submitDiagnostics,
} from '../helpers/crossword.mjs'

const LANG = 'en'
// Contraseña del mock de la billetera en memoria (los specs la usan así, R-#239).
const WALLET_PASSWORD = '12345678'
// Mínimo del contrato (`payScholarship` exige `profileScore >= 50`).
const MIN_PROFILE_SCORE = 50
// Sierra Leona: país piloto y el que usan los otros specs.
const PAIS_ID = 694

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

/** GET autenticado dentro de una página (la cookie de sesión viaja sola). */
async function apiGet(page, url) {
  return page.evaluate(async (target) => {
    const res = await fetch(target, { credentials: 'same-origin' })
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  }, url)
}

/** PATCH autenticado dentro de una página. */
async function apiPatch(page, url, payload) {
  return page.evaluate(async ({ target, data }) => {
    const res = await fetch(target, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  }, { target: url, data: payload })
}

async function guideStatus(page, address, courseId, guideNumber) {
  const { body } = await apiGet(
    page,
    `/api/guide-status?courseId=${courseId}&guideNumber=${guideNumber}&walletAddress=${encodeURIComponent(address)}`,
  )
  return body
}

/**
 * Cursos donde esta billetera **puede**: leer una guía (gratuita, o de pago ya
 * comprada), servir crucigrama con pistas y tener vault con fondos para pagar beca.
 * Devuelve `[{ courseId, prefix, guides: [...sufijos], guide, guideNumber }]`.
 */
async function findCandidates(page, wallet, limit) {
  const list = await apiGet(page, `/api/course-catalog?filtro[busidioma]=${LANG}`)
  const catalog = Array.isArray(list.body) ? list.body : []
  const found = []
  for (const course of catalog) {
    if (found.length >= limit) break
    const prefix = String(course.prefijoRuta || '').replace(/^\/+/, '')
    const courseId = Number(course.id)
    if (!prefix || !courseId) continue
    const detail = await apiGet(page, `/api/course-catalog/${courseId}`)
    const guides = (detail.body?.guias || []).map((guide) => String(guide.sufijoRuta || '')).filter(Boolean)
    if (guides.length === 0) continue
    // El vault decide si hay con qué pagar: sin fondos la beca no llega y la prueba
    // no podría afirmar nada sobre el pago.
    const scholarship = await apiGet(
      page,
      `/api/scholarship?courseId=${courseId}&walletAddress=${encodeURIComponent(wallet)}`,
    )
    const vault = scholarship.body || {}
    if (!vault.vaultCreated || Number(vault.amountPerGuide || 0) <= 0) continue
    if (vault.canSubmit === false) continue
    for (let index = 0; index < guides.length; index++) {
      // La guía tiene que poder leerse con esta billetera (una de pago sin compra
      // responde 401/403) y su crucigrama tiene que traer pistas.
      const guide = await apiGet(
        page,
        `/api/guide?courseId=${courseId}&lang=${LANG}&prefix=${encodeURIComponent(prefix)}` +
          `&guide=${encodeURIComponent(guides[index])}&guideNumber=${index + 1}&walletAddress=${encodeURIComponent(wallet)}`,
      )
      if (guide.status !== 200 || !guide.body?.markdown) continue
      const puzzle = await apiGet(
        page,
        `/api/crossword?courseId=${courseId}&lang=${LANG}&prefix=${encodeURIComponent(prefix)}` +
          `&guide=${encodeURIComponent(guides[index])}&walletAddress=${encodeURIComponent(wallet)}`,
      )
      if ((puzzle.body?.placements || []).length === 0) continue
      found.push({ courseId, prefix, guides, guide: guides[index], guideNumber: index + 1, titulo: course.titulo })
      break
    }
  }
  return found
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const verifier = loadEnvCredentials()
  if (!verifier) {
    console.error('No credentials found in apps/.env')
    process.exit(1)
  }

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { timeout, chainId } = env
  const { base } = resolveSiteTarget(env)

  const browser = await launchBrowser(env.headless)
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(120000)

  // ── 1. La billetera NUEVA ─────────────────────────────────────────────
  // `installCoreWalletMock` sin llave crea una; se crea antes para conocer la
  // dirección y pasarla también al SIWE (si no, cada llamada crearía otra).
  const wallet = await createTestWallet()
  const learner = { pk: wallet.privateKey, addr: wallet.address }
  console.log(`\nBilletera nueva: ${learner.addr} | sitio ${base}\n`)

  await installCoreWalletMock(page, { privateKey: learner.pk, address: learner.addr, chainId, password: WALLET_PASSWORD })
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await signInWithCoreWallet(page, { privateKey: learner.pk, address: learner.addr, chainId, baseUrl: base, password: WALLET_PASSWORD })
  ok('Billetera nueva registrada por SIWE (sesión creada en la prueba)')

  const mine = await apiGet(page, `/api/profile?walletAddress=${encodeURIComponent(learner.addr)}`)
  const userId = mine.body?.id ?? mine.body?.userId
  if (!userId) {
    fail(`No se pudo leer el perfil de la billetera nueva (HTTP ${mine.status})`)
    await browser.close()
    summary('offline-two-courses')
    process.exit(1)
  }

  // ── 2. Elegibilidad (>= 50 puntos de perfil) ──────────────────────────
  const testName = `E2E Offline ${learner.addr.slice(2, 8)}`
  const profilePatch = await apiPatch(
    page,
    `/api/profile?walletAddress=${encodeURIComponent(learner.addr)}`,
    { nombre: testName, pais_id: PAIS_ID },
  )
  if (profilePatch.status !== 200) {
    fail(`No se pudo completar el perfil para la prueba (HTTP ${profilePatch.status})`)
  }

  // El verificador confirma nombre y nacionalidad (los dos criterios que suman 26 + 24):
  // es lo que un usuario real consigue con la verificación de identidad. Va en un
  // contexto aparte para no pisar la cookie de la sesión del estudiante.
  const verifierContext = await browser.createBrowserContext()
  const verifierPage = await verifierContext.newPage()
  await verifierPage.setDefaultNavigationTimeout(120000)
  await installCoreWalletMock(verifierPage, { privateKey: verifier.pk, address: verifier.addr, chainId, password: WALLET_PASSWORD })
  await verifierPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await signInWithCoreWallet(verifierPage, { privateKey: verifier.pk, address: verifier.addr, chainId, baseUrl: base, password: WALLET_PASSWORD })
  const isVerifier = await apiGet(verifierPage, `/api/admin/check-verifier?wallet=${encodeURIComponent(verifier.addr)}`)
  if (isVerifier.body?.isVerifier !== true) {
    console.log('[SKIP] la billetera de `apps/.env` no es verificadora en este sitio: no se pueden confirmar los campos del perfil')
    await browser.close()
    process.exit(0)
  }
  const adminPatch = await apiPatch(
    verifierPage,
    `/api/admin/user/${userId}?wallet=${encodeURIComponent(verifier.addr)}`,
    { passport_name: testName, passport_nationality: PAIS_ID },
  )
  if (adminPatch.status !== 200) {
    fail(`El verificador no pudo confirmar los datos del perfil (HTTP ${adminPatch.status})`)
  }
  const profile = await apiGet(page, `/api/profile?walletAddress=${encodeURIComponent(learner.addr)}`)
  const score = Number(profile.body?.profilescore ?? 0)
  if (score >= MIN_PROFILE_SCORE) {
    ok(`Perfil elegible dentro de la prueba: profilescore = ${score} (mínimo ${MIN_PROFILE_SCORE})`)
  } else {
    fail(`El perfil quedó en ${score} puntos: la beca no se pagaría (se necesitan ${MIN_PROFILE_SCORE})`)
    await browser.close()
    summary('offline-two-courses')
    process.exit(1)
  }

  // ── 3. Dos cursos diferentes, con guía legible y crucigrama ───────────
  const candidates = await findCandidates(page, learner.addr, 2)
  if (candidates.length < 2) {
    console.log(`[SKIP] solo ${candidates.length} curso(s) sirven para la prueba (hace falta: guía legible + crucigrama con pistas + vault con fondos). Candidatos: ${candidates.map((c) => c.prefix).join(', ') || 'ninguno'}.`)
    await browser.close()
    process.exit(0)
  }
  console.log(`Cursos: ${candidates.map((c) => `${c.prefix} (id ${c.courseId}, guía ${c.guideNumber})`).join(' | ')}\n`)

  // Una pestaña por curso: cada crucigrama vive en su página y hay que enviarlo desde
  // ahí. Las dos comparten origen (cookie, IndexedDB y localStorage).
  const pages = [page, await browser.newPage()]
  await pages[1].setDefaultNavigationTimeout(120000)

  const plans = []
  // Replays observados en **las dos** pestañas: la cola la puede drenar cualquiera de
  // las dos (el candado que la hace única es de módulo, o sea por pestaña), así que el
  // replay de cada curso se identifica por el `courseId` que lleva el cuerpo enviado y no
  // por la pestaña que lo vio.
  const replays = []
  for (const [index, candidate] of candidates.entries()) {
    const target = pages[index]
    const coursePath = `/${LANG}/${candidate.prefix}`
    const guidePath = `${coursePath}/${candidate.guide}`
    const testPath = `${guidePath}/test`

    // En línea: la guía (su Markdown) y su crucigrama.
    await target.goto(`${base}${guidePath}`, { waitUntil: 'domcontentloaded' })
    await sleep(1500)
    const online = await openCrosswordOnline(target, `${base}${testPath}`, { timeout })
    if (online.cells === 0) {
      fail(`El crucigrama de ${candidate.prefix} no se renderizó en línea`)
      await browser.close()
      summary('offline-two-courses')
      process.exit(1)
    }

    let pairs = []
    try {
      pairs = answersFromGuideFile(LANG, candidate.prefix, candidate.guide)
    } catch (error) {
      fail(`No se pudo leer el Markdown de la guía ${candidate.prefix}/${candidate.guide}: ${error.message}`)
      await browser.close()
      summary('offline-two-courses')
      process.exit(1)
    }
    let solved = null
    try {
      solved = solveCrossword(online.puzzleData.grid, online.puzzleData.placements, pairs)
    } catch (error) {
      fail(`No se pudo resolver el crucigrama de ${candidate.prefix}: ${error.message}`)
      await browser.close()
      summary('offline-two-courses')
      process.exit(1)
    }

    // El estado guardado de corridas anteriores se descarta para que la entrega sea la
    // de ahora (la clave es por dirección y el estado lleva curso y guía).
    await target.evaluate(() => {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('crossword-state-'))
        .forEach((k) => localStorage.removeItem(k))
    })
    const filled = await fillSolved(target, solved)
    await sleep(500)
    const statusBefore = await guideStatus(target, learner.addr, candidate.courseId, candidate.guideNumber).catch(() => null)
    ok(`${candidate.prefix}: guía en línea con ${online.cells} celdas, ${filled} rellenas` +
      ` [antes] completada=${!!statusBefore?.completed} becaUSDT=${!!statusBefore?.receivedScholarship}`)

    plans.push({ candidate, target, testPath, statusBefore })
  }

  // ── 4. Sin conexión: los dos crucigramas se envían y quedan en la cola ─
  for (const plan of plans) {
    plan.target.on('response', (response) => {
      if (!response.url().includes('/api/check-crossword')) return
      let request = null
      try { request = JSON.parse(response.request().postData() || 'null') } catch { /* sin cuerpo */ }
      response.json()
        .then((body) => replays.push({ status: response.status(), body, request }))
        .catch(() => replays.push({ status: response.status(), body: null, request }))
    })
    await plan.target.setOfflineMode(true)
  }
  await sleep(1500)

  for (const plan of plans) {
    const submitted = await clickSubmit(plan.target)
    if (!submitted) {
      console.log(`  [diag ${plan.candidate.prefix}] ${JSON.stringify(await submitDiagnostics(plan.target))}`)
      fail(`El botón de envío de ${plan.candidate.prefix} estaba deshabilitado sin conexión`)
    }
  }
  await sleep(3000)

  const pendingA = await pendingCount(plans[0].target)
  const pendingB = await pendingCount(plans[1].target)
  const queued = await pendingInIndexedDb(plans[0].target)
  if (pendingA > 0 && pendingB > 0 && queued >= 2) {
    ok(`Los dos crucigramas quedaron encolados sin conexión (indicadores ${pendingA} y ${pendingB}, IndexedDB ${queued})`)
  } else {
    fail(`La cola no tiene las dos respuestas (indicadores ${pendingA}/${pendingB}, IndexedDB ${queued})`)
  }

  // ── 5. En línea otra vez: la cola se drena y **los dos cursos pagan** ──
  for (const plan of plans) {
    await plan.target.setOfflineMode(false)
    await plan.target.evaluate(() => window.dispatchEvent(new Event('online')))
  }
  let drained = -1
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(2000)
    drained = await pendingCount(plans[0].target)
    const left = await pendingInIndexedDb(plans[0].target)
    if (drained === 0 && left === 0) break
  }
  const leftInDb = await pendingInIndexedDb(plans[0].target)
  if (drained === 0 && leftInDb === 0) {
    ok('La cola se drenó al volver la conexión (indicadores e IndexedDB vacíos)')
  } else {
    fail(`La cola quedó con ${drained} pendiente(s) (IndexedDB ${leftInDb})`)
  }

  for (const plan of plans) {
    const { candidate } = plan
    // Replay de **este curso**: el último cuyo cuerpo lleve su `courseId`.
    const mine = replays.filter((item) => Number(item.request?.courseId) === candidate.courseId)
    const last = mine[mine.length - 1]
    if (!last) {
      fail(`No se observó el replay de ${candidate.prefix} a /api/check-crossword`)
      continue
    }
    if (last.status !== 200 || last.body?.error) {
      fail(`El replay de ${candidate.prefix} fue rechazado (HTTP ${last.status}): ${JSON.stringify(last.body).slice(0, 160)}`)
      continue
    }
    const usdt = Number(last.body?.scholarshipUsdt || 0)
    const slearn = Number(last.body?.scholarshipSlearn || 0)
    if (usdt > 0 || slearn > 0) {
      ok(`${candidate.prefix}: beca pagada al reconectar (${usdt} USDT + ${slearn} SLEARN)`)
    } else {
      fail(`${candidate.prefix}: el replay fue 200 pero sin beca: ${JSON.stringify(last.body).slice(0, 200)}`)
    }

    const after = await guideStatus(plan.target, learner.addr, candidate.courseId, candidate.guideNumber).catch(() => null)
    if (!after || after.error) {
      fail(`No se pudo leer el estado de ${candidate.prefix} tras el replay: ${JSON.stringify(after)}`)
      continue
    }
    if (after.completed && after.receivedScholarship && after.receivedSlearnScholarship) {
      ok(`${candidate.prefix}: la guía quedó completada con las dos becas (USDT y SLEARN)`)
    } else {
      fail(`${candidate.prefix}: la guía quedó incompleta (completed=${!!after.completed}` +
        ` becaUSDT=${!!after.receivedScholarship} becaSLEARN=${!!after.receivedSlearnScholarship})`)
    }
  }

  // El enfriamiento es por curso: haber pagado en el primero no puede haber bloqueado el
  // segundo (es la regresión que este spec existe para fijar).
  const paidCourses = new Set(
    replays
      .filter((item) => item.status === 200 && !item.body?.error &&
        (Number(item.body?.scholarshipUsdt || 0) > 0 || Number(item.body?.scholarshipSlearn || 0) > 0))
      .map((item) => Number(item.request?.courseId)),
  )
  if (paidCourses.size === 2) {
    ok('Dos cursos diferentes pagaron beca en la misma sesión (el enfriamiento es por curso, no por billetera)')
  } else {
    fail(`Solo ${paidCourses.size} de 2 cursos pagaron: el enfriamiento no debe bloquear otro curso`)
  }

  const seconds = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\n(${seconds} s)`)
  await browser.close()
  summary('offline-two-courses')
}

main().catch((error) => {
  fail(`Excepción no controlada: ${error?.message || error}`)
  summary('offline-two-courses')
  process.exit(1)
})
