// R-#239 / R-#284: helpers shared by the specs that sign in with the in-app wallet.
//
// The wallet **mock** now comes from `@pasosdejesus/m/e2e` (`setupFullWalletMock`,
// `m/REQ/14` + `m/REQ/49` P8): it signs `personal_sign`/`eth_signTypedData_v4` for real
// and announces an EIP-6963 provider. This file keeps only what is app-specific:
//
//   - `signInWithCoreWallet`: SIWE + NextAuth (CSRF + callback + cookie), signing with
//     the private key (viem) instead of re-importing it into the wallet core.
//   - the UI drivers of `WalletDialog` (`chooseWalletProtection`,
//     `completeBackupVerification`) and of the header (`waitForExternalConnect`,
//     `useExternalWalletInHeader`).
//
// Usage:
//
//   import { setupFullWalletMock } from '@pasosdejesus/m/e2e'
//   import { signInWithCoreWallet } from '../helpers/in-app-wallet.mjs'
//   await setupFullWalletMock(page, { privateKey, address, chainId })   // before goto
//   await page.goto(url)
//   await signInWithCoreWallet(page, { privateKey, address, chainId, baseUrl })

import { getAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

export const TEST_PASSWORD = '12345678'

/** A brand-new key pair (viem), e.g. to sign in with a wallet that has no history. */
export function createTestWallet() {
  const privateKey = generatePrivateKey()
  return { privateKey, address: privateKeyToAccount(privateKey).address }
}

/**
 * Signs in without clicking the UI: builds the SIWE message in Node, signs it with
 * the private key and posts the callback inside the page so the NextAuth session
 * cookie lands in the browser jar (R-#233 Phase 2: the cookie is the credential).
 */
export async function signInWithCoreWallet(page, { privateKey, address, chainId = 11142220, baseUrl }) {
  const account = privateKeyToAccount(privateKey)

  // SIWE needs a checksummed address in the message; the app keeps the lowercase
  // form for its comparisons.
  const checksummed = getAddress(address || account.address)
  const { SiweMessage } = await import('siwe')
  const url = new URL(baseUrl)
  const domain = url.port ? `${url.hostname}:${url.port}` : url.hostname

  const { csrfToken } = await page.evaluate(async () => {
    const response = await fetch('/api/auth/csrf')
    return response.json()
  })
  if (!csrfToken) throw new Error('Could not get the CSRF token')

  const message = new SiweMessage({
    domain,
    address: checksummed,
    statement: 'Sign in to Learn through games.',
    uri: baseUrl,
    version: '1',
    chainId,
    nonce: csrfToken,
  }).prepareMessage()

  const signature = await account.signMessage({ message })

  const result = await page.evaluate(
    async ({ csrfToken, message, signature }) => {
      const body = new URLSearchParams({
        csrfToken,
        message,
        signature,
        redirect: 'false',
        json: 'true',
      })
      const response = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        redirect: 'manual',
      })
      return { ok: response.ok, status: response.status, body: (await response.text()).slice(0, 120) }
    },
    { csrfToken, message, signature },
  )

  if (result.ok) {
    await page.evaluate((addr) => {
      localStorage.setItem('learn.tg.sessionAddress', addr)
    }, checksummed.toLowerCase())
  } else {
    throw new Error(`SIWE sign-in failed: ${result.status} ${result.body}`)
  }

  return { sessionAddress: checksummed.toLowerCase(), status: result.status }
}

/**
 * R-#238/R-#244: the header now shows `WalletSelector`, which offers the in-app
 * wallet first and the external one behind "Use external wallet". Specs written
 * against the old header (plain `ConnectWalletButton`) must switch to the
 * external path before looking for the "Connect Wallet" button. Returns true as
 * soon as "Connect Wallet" is on screen.
 */
export async function waitForExternalConnect(page, { timeout = 45000, interval = 1500 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const connectVisible = await page.evaluate(
      () =>
        document.body.textContent?.includes('Connect Wallet') ||
        document.body.textContent?.includes('Conectar Billetera'),
    )
    if (connectVisible) return true
    const external = await page.$('[data-testid="wallet-use-external"]')
    if (external) await external.click().catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  return false
}

/** Clicks "Use external wallet" in the header (once the header has hydrated). */
export async function useExternalWalletInHeader(page, { timeout = 30000, interval = 1000 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const external = await page.$('[data-testid="wallet-use-external"]')
    if (external) {
      await external.click()
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  return false
}

/**
 * Answers the dialog's protection step when it appears (operator report, 2026-09-28):
 * right after typing the password the dialog asks whether to unlock with the password
 * only or with the gesture (fingerprint/face), and leaves the gesture as the default.
 * Without this answer, a Chrome with a virtual authenticator (PRF) never reaches the
 * 12 words.
 *
 * It is tolerant with earlier builds, where the step does not exist; `gesture: true`
 * keeps the gesture option (the default one) for the specs that exercise that path.
 * Returns whether the step was present.
 */
export async function chooseWalletProtection(page, { gesture = false, timeout = 5000 } = {}) {
  const step = await page.waitForSelector('[data-testid="wallet-protect"]', { timeout }).catch(() => null)
  if (!step) return false
  if (!gesture) await page.click('[data-testid="wallet-protect-password"]').catch(() => {})
  await page.click('[data-testid="wallet-protect-continue"]').catch(() => {})
  return true
}

/**
 * Completa la confirmación del respaldo (R-#249): lee las 12 palabras de la
 * pantalla, pulsa "ya las anoté" y responde las tres posiciones que pide.
 *
 * Es tolerante con builds anteriores, donde sólo existía "ya las guardé, ingresar"
 * (`wallet-signin`): cada paso se intenta y se ignora si no está.
 */
export async function completeBackupVerification(page) {
  const words = await page
    .$eval('[data-testid="wallet-recovery-words"]', (ol) =>
      [...ol.querySelectorAll('li')].map((li) => {
        const spans = li.querySelectorAll('span')
        return {
          position: Number((spans[0]?.textContent || '').replace(/[^0-9]/g, '')),
          word: (spans[1]?.textContent || '').trim(),
        }
      }),
    )
    .catch(() => [])

  await page.click('[data-testid="wallet-words-done"]').catch(() => {})
  await page.click('[data-testid="wallet-words-done-footer"]').catch(() => {})
  for (const { position, word } of words) {
    const selector = `[data-testid="wallet-verify-${position}"]`
    if (word && (await page.$(selector))) await page.type(selector, word)
  }
  await page.click('[data-testid="wallet-verify"]').catch(() => {})
  await page.click('[data-testid="wallet-signin"]').catch(() => {})
  return words.length
}
