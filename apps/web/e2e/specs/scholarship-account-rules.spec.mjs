#!/usr/bin/env node
// E2E de las dos reglas de beca por **cuenta** (R-#303), con dos billeteras enlazadas:
//
// Dos envíos consecutivos: la primera billetera paga la guía n; la segunda, enlazada a la
// misma cuenta, intenta la guía n+1. Lo que se prueba:
//
//   1. el enfriamiento de 24 h es de la cuenta, no de la billetera (el caso reportado el
//      2026-11-20): el segundo envío se rechaza con el mensaje de espera y no paga;
//   2. una guía se paga una sola vez por cuenta (R-#265 §3.3): la guía n desde la segunda
//      billetera responde `already_paid` ("another wallet").
//
// Hace pagos **reales** de testnet (una beca por corrida), a propósito: es la única forma de
// comprobar que el contrato no se vuelve a llamar. Por eso el spec busca una cuenta del
// registro con la menos dos guías del curso GD sin pagar; si no hay, compra el curso para una
// billetera nueva (`ensureCoursePastors`, el mismo camino de la siembra de pastores).
//
// Ejecución:
//   make test-e2e-spec SPEC=scholarship-account-rules

import { fail, initTestEnv, launchBrowser, newIncognitoContext, newIncognitoPage, newPage, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { SiweMessage } from 'siwe'
import { privateKeyToAccount } from 'viem/accounts'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadVerifierWallet } from '../helpers/e2e-wallet.mjs'
import { apiOn } from '../helpers/e2e-fixture.mjs'
import { createTestWallet } from '../helpers/in-app-wallet.mjs'
import { listWallets, rememberWallet } from '../helpers/e2e-wallets-registry.mjs'
import { ensureCoursePastors, freeCoursePastors } from '../helpers/seed-course-pastor.mjs'
import { answersFromGuideFile, openCrosswordOnline, solveCrossword } from '../helpers/crossword.mjs'

const LANG = 'en'
const PREFIX = 'gdcluster'
const COURSE_ID = 10
const GUIDES = [1, 2, 3, 4, 5, 6]

/** Guías del curso sin beca (USDT ni SLEARN) para la cuenta de esa billetera. */
async function unpaidGuides(page, wallet) {
  const unpaid = []
  for (const n of GUIDES) {
    const res = await apiOn(
      page,
      `/api/guide-status?walletAddress=${wallet}&courseId=${COURSE_ID}&guideNumber=${n}`,
    )
    if (res.status !== 200) continue
    if (!res.body?.receivedScholarship && !res.body?.receivedSlearnScholarship) unpaid.push(n)
  }
  return unpaid
}

/**
 * Resuelve el crucigrama desde el Markdown local y lo envía por la API.
 *
 * El tablero se toma como lo toma la página: abriendo `/test` y capturando el `GET
 * /api/crossword` (`openCrosswordOnline`, el mismo ayudante de las specs de crucigrama).
 * Así el cuerpo lleva exactamente `grid` y `placements` con la forma que espera la ruta.
 */
async function submitGuide(page, base, wallet, guideNumber) {
  const url = `${base}/${LANG}/${PREFIX}/guide${guideNumber}/test`
  const { puzzleData, failure } = await openCrosswordOnline(page, url, { timeout: 45000 })
  if (!puzzleData?.placements?.length) {
    return { status: 0, body: null, error: `sin crucigrama: ${JSON.stringify(failure ?? null).slice(0, 160)}` }
  }
  const pairs = answersFromGuideFile(LANG, PREFIX, `guide${guideNumber}`)
  const solved = solveCrossword(puzzleData.grid, puzzleData.placements, pairs)
  return apiOn(page, '/api/check-crossword', {
    method: 'POST',
    body: JSON.stringify({
      courseId: COURSE_ID,
      guideId: guideNumber,
      lang: LANG,
      walletAddress: wallet,
      grid: solved,
      placements: puzzleData.placements,
    }),
  })
}

/**
 * Cuentas del registro con el curso GD. Se prueban de la **más reciente** a la más antigua:
 * la que se compró en una corrida anterior suele conservar sus seis guías sin beca, así que
 * normalmente sirve la primera y no hace falta comprar de nuevo.
 */
function courseOwners() {
  return listWallets()
    .filter((row) => row.hasGdCourse === true && !row.clusterCompletedAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

/**
 * La beca exige `profilescore >= 50` (la cuenta nueva no lo tiene). Se completan las
 * verificaciones con el panel del verificador, que recalcula el puntaje: nombre (26),
 * país (24) y correo (9) ya suman 59.
 */
async function ensureScoring(ownerPage, verifierPage, verifierAddress, ownerAddress) {
  const before = await apiOn(ownerPage, `/api/profile?walletAddress=${ownerAddress}`)
  const profile = before.body ?? {}
  if (Number(profile.profilescore ?? 0) >= 50) return Number(profile.profilescore)

  const userId = profile.id
  if (!userId) return Number(profile.profilescore ?? 0)
  const patch = await apiOn(verifierPage, `/api/admin/user/${userId}?wallet=${verifierAddress}`, {
    method: 'PATCH',
    body: JSON.stringify({
      passport_name: profile.nombre || profile.email || `E2E Student ${userId}`,
      passport_nationality: profile.pais_id ?? 694,
      verified_email: profile.email || `e2e-${userId}@example.org`,
      verified_whatsapp: profile.whatsapp || '+232000000000',
    }),
  })
  const after = await apiOn(ownerPage, `/api/profile?walletAddress=${ownerAddress}`)
  const score = Number(after.body?.profilescore ?? 0)
  if (score >= 50) ok(`perfil verificado para la beca (puntaje ${score}, PATCH ${patch.status})`)
  return score
}

/** Enlaza una billetera nueva a la cuenta de `owner` desde su página (SIWE). */
async function linkSecondWallet(ownerPage, base, chainId, ownerAddress) {
  const second = createTestWallet()
  const account = privateKeyToAccount(second.privateKey)
  const nonce = await ownerPage.evaluate(async () => {
    const res = await fetch('/api/auth/csrf')
    return (await res.json()).csrfToken
  })
  const message = new SiweMessage({
    domain: new URL(base).host,
    address: account.address,
    statement: 'Sign in to Learn through games.',
    uri: base,
    version: '1',
    chainId,
    nonce,
  }).prepareMessage()
  const signature = await account.signMessage({ message })
  const link = await apiOn(ownerPage, '/api/wallet/link', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: ownerAddress, message, signature }),
  })
  return { wallet: second, status: link.status, body: link.body }
}

/**
 * Guías cuyos crucigramas se pueden resolver con el Markdown **local**. Si el sitio sirve
 * una versión anterior de una guía, la pista no coincide y `solveCrossword` falla: esa guía
 * se descarta en vez de tumbar la corrida (pasa mientras un cambio de guía no está desplegado).
 */
async function solvableGuides(page, base, candidates) {
  const solvable = []
  for (const n of candidates) {
    const { puzzleData } = await openCrosswordOnline(page, `${base}/${LANG}/${PREFIX}/guide${n}/test`, { timeout: 45000 })
    if (!puzzleData?.placements?.length) continue
    try {
      solveCrossword(puzzleData.grid, puzzleData.placements, answersFromGuideFile(LANG, PREFIX, `guide${n}`))
      solvable.push(n)
    } catch {
      console.log(`  [nota] la guía ${n} no se puede resolver con el Markdown local (el sitio sirve otra versión)`)
    }
  }
  return solvable
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'
  const chainId = Number(process.env.CHAIN_ID)

  const env = await initTestEnv()
  const { timeout } = env
  const { base } = resolveSiteTarget(env)

  // Una cuenta con el curso GD y **dos** guías sin beca: una para pagar y otra para el
  // enfriamiento. Se busca en el registro; si ninguna sirve se compra el curso para una
  // billetera nueva (`ensureCoursePastors`), que es lo que gasta una beca de testnet.
  const browser = await launchBrowser(env.headless)
  let owner = null
  let ownerPage = null
  let unpaid = []
  for (const candidate of courseOwners()) {
    const page = await newPage(browser, candidate.address, timeout)
    try {
      await setupE2EAuth(page, candidate.address, candidate.privateKey, chainId, base)
    } catch (error) {
      console.log(`  [nota] ${candidate.address.slice(0, 10)}… sin sesión: ${error.message.slice(0, 80)}`)
      await page.close().catch(() => {})
      continue
    }
    const free = await unpaidGuides(page, candidate.address)
    if (free.length >= 2) {
      owner = candidate
      ownerPage = page
      unpaid = free
      ok(`cuenta con el curso y guías sin beca: ${owner.address.slice(0, 10)}…`)
      break
    }
    await page.close().catch(() => {})
  }

  if (!owner) {
    console.log('  [nota] ninguna cuenta del registro tiene dos guías sin beca: se compra el curso')
    const seeded = ensureCoursePastors(1, { log: (m) => console.log(m) })
    // La cuenta comprada (o la última del registro) es la que conserva sus seis guías sin beca.
    const fresh = [...freeCoursePastors()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]
    if (!seeded.ok || !fresh) {
      console.log('  [SKIP] no se pudo preparar una cuenta con dos guías sin beca')
      await browser.close()
      process.exit(0)
    }
    owner = fresh
    ownerPage = await newPage(browser, owner.address, timeout)
    await setupE2EAuth(ownerPage, owner.address, owner.privateKey, chainId, base)
    unpaid = await unpaidGuides(ownerPage, owner.address)
    ok(`cuenta comprada para esta corrida: ${owner.address.slice(0, 10)}…`)
  }

  if (unpaid.length < 2) {
    console.log(
      `  [SKIP] la cuenta tiene ${unpaid.length} guía(s) sin beca y se necesitan dos ` +
        '(una para pagar y otra para el enfriamiento)',
    )
    await browser.close()
    process.exit(0)
  }

  // Verificador: se usa para completar el perfil de la cuenta (puntaje >= 50).
  const verifier = loadVerifierWallet()
  const verifierContext = await newIncognitoContext(browser)
  const verifierPage = await newIncognitoPage(verifierContext, verifier.address, timeout)
  await setupE2EAuth(verifierPage, verifier.address, verifier.pk, chainId, base)

  const score = await ensureScoring(ownerPage, verifierPage, verifier.address, owner.address)
  if (score < 50) {
    console.log(`  [SKIP] el perfil de la cuenta quedó con puntaje ${score} y la beca exige 50`)
    await browser.close()
    process.exit(0)
  }

  const solvable = await solvableGuides(ownerPage, base, unpaid)
  if (solvable.length < 2) {
    console.log(
      `  [SKIP] solo ${solvable.length} guía(s) sin beca se pueden resolver con el Markdown local ` +
        `(de ${unpaid.join(', ')})`,
    )
    await browser.close()
    process.exit(0)
  }
  const [paidGuide, cooldownGuide] = solvable
  console.log(`  [info] guías utilizables: ${solvable.join(', ')} · se paga la ${paidGuide} y se prueba el enfriamiento con la ${cooldownGuide}`)

  const linked = await linkSecondWallet(ownerPage, base, chainId, owner.address)
  if (linked.status !== 200) {
    fail(`wallet/link → ${linked.status} ${JSON.stringify(linked.body).slice(0, 140)}`)
    await browser.close()
    summary(t0)
    process.exit(1)
  }
  rememberWallet({ privateKey: linked.wallet.privateKey, address: linked.wallet.address, role: 'member', note: 'scholarship-account-rules' })
  ok(`segunda billetera enlazada a la misma cuenta (${linked.wallet.address.slice(0, 10)}…)`)

  const secondPage = await newPage(browser, linked.wallet.address, timeout)
  try {
    await setupE2EAuth(secondPage, linked.wallet.address, linked.wallet.privateKey, chainId, base)
    ok('sesión de la segunda billetera (misma cuenta)')
  } catch (error) {
    fail(`no se pudo iniciar sesión con la segunda billetera: ${error.message}`)
    await browser.close()
    summary(t0)
    process.exit(1)
  }

  // ── 1. Envío desde la primera billetera (guía n) ────────────────────
  // Dos desenlaces son válidos para empezar: paga (y el enfriamiento nace ahora) o ya está
  // en enfriamiento por un pago anterior de la cuenta. Lo que se prueba es lo de después.
  const first = await submitGuide(ownerPage, base, owner.address, paidGuide)
  const firstText = String(first.body?.message ?? '')
  const firstPaid = first.body?.scholarship === 'paid' || first.body?.scholarship === 'already_paid'
  if (firstPaid) {
    ok(`guía ${paidGuide} pagada desde la primera billetera (${first.body.scholarship})`)
  } else if (/24 hours|24 h/i.test(firstText)) {
    ok(`la cuenta ya estaba en enfriamiento (${firstText.replace(/\s+/g, ' ').slice(0, 80)}…)`)
  } else {
    fail(
      `la primera entrega no sirve para la prueba: ` +
        `${first.status} ${JSON.stringify(first.body ?? first.error).slice(0, 200)}`,
    )
    await browser.close()
    summary(t0)
    process.exit(1)
  }

  // ── 2. Segundo envío, otra billetera de la cuenta, otra guía ────────
  // Es la prueba pedida: A paga la guía n y B intenta la n+1; el enfriamiento es de la
  // cuenta, así que B no puede enviar y recibe el error de espera.
  const cooled = await submitGuide(secondPage, base, linked.wallet.address, cooldownGuide)
  const cooledText = String(cooled.body?.message ?? '')
  if (
    cooled.status === 200 &&
    cooled.body?.scholarship === 'not_paid' &&
    /waiting period of 24 hours/i.test(cooledText)
  ) {
    ok(`guía ${cooldownGuide} desde la segunda billetera → enfriamiento por cuenta ("24 hours")`)
  } else {
    fail(
      `el enfriamiento por cuenta no se aplicó a la segunda billetera: ` +
        `${cooled.status} ${JSON.stringify(cooled.body).slice(0, 240)}`,
    )
  }

  // ── 3. La guía del enfriamiento no quedó pagada ─────────────────────
  const statusAfter = await apiOn(
    secondPage,
    `/api/guide-status?walletAddress=${linked.wallet.address}&courseId=${COURSE_ID}&guideNumber=${cooldownGuide}`,
  )
  const paidAfter = !!(statusAfter.body?.receivedScholarship || statusAfter.body?.receivedSlearnScholarship)
  if (paidAfter) {
    fail(`la guía ${cooldownGuide} quedó pagada a pesar del enfriamiento`)
  } else {
    ok(`la guía ${cooldownGuide} quedó sin beca (el enfriamiento bloquea el pago)`)
  }

  // ── 4. La misma guía desde la segunda billetera: ya pagada ──────────
  if (firstPaid) {
    const again = await submitGuide(secondPage, base, linked.wallet.address, paidGuide)
    if (
      again.status === 200 &&
      again.body?.alreadyPaid === true &&
      again.body?.scholarship === 'already_paid' &&
      /another wallet/i.test(String(again.body?.message ?? ''))
    ) {
      ok(`la misma guía ${paidGuide} desde la segunda billetera → already_paid ("another wallet")`)
    } else {
      fail(
        `la misma guía desde otra billetera no fue rechazada: ` +
          `${again.status} ${JSON.stringify(again.body).slice(0, 240)}`,
      )
    }
  } else {
    console.log('  [nota] no se intentó la guía repetida: en esta corrida la pagó una corrida anterior')
  }

  await browser.close()

  const seconds = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\nDuración: ${seconds}s`)
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
