// A wallet that can receive a scholarship, created inside the spec only when
// there is no reusable one.
//
// Specs that pay used to depend on the state of the wallet in `apps/.env`: once
// that wallet had paid every guide of the test course (or its church already had
// a lead pastor), the spec could only skip or fail for reasons that were not the
// product's. This helper:
//
//   1. tries the wallets of the local registry (`apps/.e2e-wallets.local.json`,
//      gitignored) that were already used for this kind of test — reuse first,
//   2. and only when none of them is usable creates a key pair, signs in by SIWE,
//      fills the profile (name + pilot country) and has the verifier confirm name
//      and nationality (26 + 24 points), which is what `payScholarship` requires
//      (`profileScore >= 50`).
//
// Every wallet it touches leaves a trace in that JSON: `lastUsedAt`, the observed
// `score` and the note of the spec. The verifier is the `apps/.env` wallet
// (override with the `verifier` option); when it is not a verifier on that site
// the helper returns `{ skipped }` instead of failing, so a spec can degrade to a
// skip.
import { setupFullWalletMock } from '@pasosdejesus/m/e2e'

import { createTestWallet, signInWithCoreWallet } from './in-app-wallet.mjs'
import { markWalletUsed, recentByRole, rememberWallet } from './e2e-wallets-registry.mjs'

/** The contract (`LearnTGVaultsV5.payScholarship`) rejects below this score. */
export const MIN_PROFILE_SCORE = 50
/** Sierra Leone: pilot country, the one the other specs use. */
export const PILOT_COUNTRY_ID = 694

/** GET inside a page: the session cookie travels with `credentials: 'same-origin'`. */
export async function apiGetOn(page, url) {
  return page.evaluate(async (target) => {
    const res = await fetch(target, { credentials: 'same-origin' })
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  }, url)
}

/** PATCH inside a page, same cookie. */
export async function apiPatchOn(page, url, payload) {
  return page.evaluate(
    async ({ target, data }) => {
      const res = await fetch(target, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => null)
      return { status: res.status, body }
    },
    { target: url, data: payload },
  )
}

/** Opens a page already signed in with a remembered wallet. */
async function pageFor({ browser, base, chainId, timeout, wallet }) {
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(timeout)
  await setupFullWalletMock(page, {
    privateKey: wallet.privateKey,
    address: wallet.address,
    chainId,
  })
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await signInWithCoreWallet(page, {
    privateKey: wallet.privateKey,
    address: wallet.address,
    chainId,
    baseUrl: base,
  })
  return page
}

/**
 * Returns a wallet with `profilescore >= 50`, reusing one from the registry when
 * possible and creating one only when it is not.
 *
 * `isUsable(page, wallet)` is an optional extra check the caller supplies (for
 * example "this wallet still has a guide whose scholarships are unpaid"). When it
 * returns false the candidate is skipped and the next one is tried.
 *
 * Returns `{ learner: { pk, addr, address }, page, userId, score, reused }`, or
 * `{ skipped: reason }`. The caller owns the page and must close it.
 */
export async function createEligibleLearner({
  browser,
  base,
  chainId,
  verifier,
  paisId = PILOT_COUNTRY_ID,
  namePrefix = 'E2E',
  timeout = 120000,
  isUsable,
  maxReuse = 3,
}) {
  const candidates = [...recentByRole('learner', { count: maxReuse }), ...recentByRole('member', { count: maxReuse })]
    .filter((row, index, all) => all.findIndex((other) => other.address === row.address) === index)
    .slice(0, maxReuse)

  for (const candidate of candidates) {
    const page = await pageFor({ browser, base, chainId, timeout, wallet: candidate })
    const profile = await apiGetOn(page, `/api/profile?walletAddress=${encodeURIComponent(candidate.address)}`)
    const userId = profile.body?.id ?? profile.body?.userId
    const score = Number(profile.body?.profilescore ?? 0)
    const usable = !!userId && score >= MIN_PROFILE_SCORE && (!isUsable || (await isUsable(page, candidate)))
    if (usable) {
      markWalletUsed(candidate.address, { score, note: candidate.note || namePrefix })
      return {
        learner: { pk: candidate.privateKey, addr: candidate.address, address: candidate.address },
        page,
        userId,
        score,
        reused: true,
      }
    }
    await page.close().catch(() => {})
  }

  // Nothing reusable: create a wallet and leave its trace in the registry.
  const wallet = createTestWallet()
  const learner = { pk: wallet.privateKey, addr: wallet.address, address: wallet.address }

  const page = await pageFor({ browser, base, chainId, timeout, wallet: { privateKey: learner.pk, address: learner.addr } })
  const profile = await apiGetOn(page, `/api/profile?walletAddress=${encodeURIComponent(learner.addr)}`)
  const userId = profile.body?.id ?? profile.body?.userId
  if (!userId) {
    return { skipped: `no se pudo leer el perfil de la billetera nueva (HTTP ${profile.status})` }
  }

  const testName = `${namePrefix} ${learner.addr.slice(2, 8)}`
  const fill = await apiPatchOn(page, `/api/profile?walletAddress=${encodeURIComponent(learner.addr)}`, {
    nombre: testName,
    pais_id: paisId,
  })
  if (fill.status !== 200) {
    return { skipped: `no se pudo completar el perfil de la billetera nueva (HTTP ${fill.status})` }
  }
  if (!verifier) {
    return { skipped: 'falta la billetera verificadora en apps/.env' }
  }

  // The verifier confirms name and nationality in its own browser context so it
  // does not overwrite the learner's session cookie.
  const verifierContext = await browser.createBrowserContext()
  const verifierPage = await verifierContext.newPage()
  await verifierPage.setDefaultNavigationTimeout(timeout)
  await setupFullWalletMock(verifierPage, { privateKey: verifier.pk, address: verifier.addr, chainId })
  await verifierPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await signInWithCoreWallet(verifierPage, {
    privateKey: verifier.pk,
    address: verifier.addr,
    chainId,
    baseUrl: base,
  })
  const isVerifier = await apiGetOn(
    verifierPage,
    `/api/admin/check-verifier?wallet=${encodeURIComponent(verifier.addr)}`,
  )
  if (isVerifier.body?.isVerifier !== true) {
    await verifierContext.close().catch(() => {})
    return { skipped: 'la billetera de apps/.env no es verificadora en este sitio' }
  }

  const confirm = await apiPatchOn(
    verifierPage,
    `/api/admin/user/${userId}?wallet=${encodeURIComponent(verifier.addr)}`,
    { passport_name: testName, passport_nationality: paisId },
  )
  await verifierContext.close().catch(() => {})
  if (confirm.status !== 200) {
    return { skipped: `el verificador no pudo confirmar el perfil (HTTP ${confirm.status})` }
  }

  const after = await apiGetOn(page, `/api/profile?walletAddress=${encodeURIComponent(learner.addr)}`)
  const score = Number(after.body?.profilescore ?? 0)
  if (score < MIN_PROFILE_SCORE) {
    return {
      skipped: `el perfil de la billetera nueva quedó en ${score} puntos (se necesitan ${MIN_PROFILE_SCORE})`,
    }
  }
  rememberWallet({
    privateKey: learner.pk,
    address: learner.addr,
    role: 'learner',
    note: namePrefix,
  })
  markWalletUsed(learner.addr, { score })
  return { learner, page, userId, score, reused: false }
}
