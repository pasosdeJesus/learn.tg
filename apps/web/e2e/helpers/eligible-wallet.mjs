// A brand-new wallet that can receive a scholarship, created inside the spec.
//
// `specs that pay` used to depend on the state of the wallet in `apps/.env`: once
// that wallet had paid every guide of the test course (or its church already had
// a lead pastor), the spec could only skip or fail for reasons that were not the
// product's. `payScholarship` requires `profileScore >= 50`, and the score comes
// from the owner's data plus the verifier's confirmations, so this helper:
//
//   1. generates a key pair and signs in by SIWE (its own session cookie),
//   2. fills the profile (name + pilot country),
//   3. has the verifier confirm name and nationality (26 + 24 points),
//   4. reads the profile back and requires the minimum.
//
// The verifier is the `apps/.env` wallet (override with the `verifier` option);
// when it is not a verifier on that site the helper returns `{ skipped }` instead
// of failing, so a spec can degrade to a skip.
import { setupFullWalletMock } from '@pasosdejesus/m/e2e'

import { createTestWallet, signInWithCoreWallet } from './in-app-wallet.mjs'

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

/**
 * Signs a page in with a brand-new wallet and takes it to `profilescore >= 50`.
 *
 * Returns `{ learner: { pk, addr, address }, page, userId, score }`, or
 * `{ skipped: reason }` when the site does not allow it (no verifier wallet, or
 * the profile cannot be confirmed). The caller owns the page and must close it.
 */
export async function createEligibleLearner({
  browser,
  base,
  chainId,
  verifier,
  paisId = PILOT_COUNTRY_ID,
  namePrefix = 'E2E',
  timeout = 120000,
}) {
  const wallet = createTestWallet()
  const learner = { pk: wallet.privateKey, addr: wallet.address, address: wallet.address }

  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(timeout)
  await setupFullWalletMock(page, { privateKey: learner.pk, address: learner.addr, chainId })
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await signInWithCoreWallet(page, { privateKey: learner.pk, address: learner.addr, chainId, baseUrl: base })

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
  return { learner, page, userId, score }
}
