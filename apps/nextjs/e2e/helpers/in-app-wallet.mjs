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
/** Clicks a button (by text) inside the open engine WalletConnect dialog. */
async function clickExternalInsideDialog(page) {
  return page
    .evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      if (!dialog) return false
      const button = [...dialog.querySelectorAll('button')].find((candidate) =>
        /connect wallet|conectar billetera/i.test(candidate.textContent || ''),
      )
      if (!button) return false
      button.click()
      return true
    })
    .catch(() => false)
}

/** Clicks "Connect Wallet" by text, wherever it is (legacy header). */
async function clickConnectByText(page) {
  return page
    .evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        /connect wallet|conectar billetera/i.test(candidate.textContent || ''),
      )
      if (!button) return false
      button.click()
      return true
    })
    .catch(() => false)
}

/**
 * Returns true when a connect entry point is on screen. It does **not** click:
 * R-#265 §3.9 moved the choice into the engine `WalletConnect` modal, so the
 * caller must use `connectExternalWallet()` to actually sign in.
 */
export async function waitForExternalConnect(page, { timeout = 45000, interval = 1500 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const visible = await page
      .evaluate(
        () =>
          !!document.querySelector('[data-testid="connect-wallet"]') ||
          !!document.querySelector('[data-testid="wallet-use-external"]') ||
          [...document.querySelectorAll('button')].some((candidate) =>
            /connect wallet|conectar billetera/i.test(candidate.textContent || ''),
          ),
      )
      .catch(() => false)
    if (visible) return true
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  return false
}

/**
 * Connects the **external** wallet: opens the engine `WalletConnect` choice modal
 * (R-#265 §3.9) and clicks the external `ConnectWalletButton` inside; on a legacy
 * header it clicks "Use external wallet" and then "Connect Wallet".
 */
export async function connectExternalWallet(page, { timeout = 60000, interval = 1500 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const trigger = await page.$('[data-testid="connect-wallet"]')
    if (trigger) {
      // Abre el modal una sola vez: volver a pulsar el trigger con el modal abierto
      // cierra el diálogo (el clic cae en el overlay de Radix).
      if (!(await page.$('[role="dialog"]'))) {
        await trigger.click().catch(() => {})
        await new Promise((resolve) => setTimeout(resolve, 600))
      }
      for (let i = 0; i < 10; i++) {
        if (await clickExternalInsideDialog(page)) return true
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } else {
      const external = await page.$('[data-testid="wallet-use-external"]')
      if (external) {
        await external.click().catch(() => {})
        await new Promise((resolve) => setTimeout(resolve, 700))
        if (await clickConnectByText(page)) return true
      } else if (await clickConnectByText(page)) {
        return true
      }
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  return false
}

/** Backwards-compatible alias: opens the choice and signs in with the external wallet. */
export async function useExternalWalletInHeader(page, options = {}) {
  return connectExternalWallet(page, options)
}

/**
 * Opens learn.tg's `WalletDialog`: clicks the in-app action when it is already in the
 * header (signed-in pill or legacy header); otherwise opens the engine `WalletConnect`
 * choice modal (R-#265 §3.9) and clicks the in-app action inside it.
 */
export async function openWalletDialog(page, { timeout = 45000, interval = 500 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const direct = await page.$('[data-testid="wallet-open-dialog"]')
    if (direct) {
      await direct.click().catch(() => {})
      return true
    }
    // Abre el modal una sola vez (volver a pulsar el trigger lo cierra).
    if (!(await page.$('[role="dialog"]'))) {
      const trigger = await page.$('[data-testid="connect-wallet"]')
      if (trigger) await trigger.click().catch(() => {})
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
    for (let i = 0; i < 8; i++) {
      const inside = await page.$('[data-testid="wallet-open-dialog"]')
      if (inside) {
        await inside.click().catch(() => {})
        return true
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
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
