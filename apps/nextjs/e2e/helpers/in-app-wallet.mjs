// R-#239: the real `@learn-tg/pdj-wallet` core (running in Node) replaces the
// `setupSIWEMock` / `simulateSIWE` mocks of `@pasosdejesus/m/e2e`.
//
// The core owns the key and does the signing; the page only gets a thin
// EIP-1193 shim whose `personal_sign` asks Node for a signature over the bridge
// (same mechanism as the old mock, different signer).
//
// Usage (before page.goto):
//
//   import { installCoreWalletMock } from '../helpers/in-app-wallet.mjs'
//   const wallet = await installCoreWalletMock(page, {
//     privateKey: envCreds.pk, address: envCreds.addr, chainId,
//   })
//   await page.goto(url)
//
// Or drive only Node-side (no browser shim):
//
//   const wallet = await importTestWallet(privateKey)
//   await signSIWEForTest(message)          // the core signs
//
// The wallet is stored with `FileStorage` (a JSON file with the encrypted
// record) in a temporary directory, so no browser IndexedDB is involved.

import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getAddress } from 'viem'
import {
  createWallet,
  deleteWallet,
  exportPrivateKey,
  importWallet,
  lockWallet,
  signSIWE,
  unlockWallet,
} from '@learn-tg/pdj-wallet'
import { FileStorage } from '@learn-tg/pdj-wallet/storage'

export const TEST_PIN = '123456'

async function tempWalletPath() {
  const dir = await mkdtemp(join(tmpdir(), 'pdj-wallet-e2e-'))
  return join(dir, 'wallet.json')
}

/** Creates a brand-new core wallet (mnemonic) in a temp file. */
export async function createTestWallet({ pin = TEST_PIN, chain = 'celoSepolia' } = {}) {
  const path = await tempWalletPath()
  const storage = new FileStorage(path)
  const { walletInfo, mnemonic } = await createWallet({ pin, chain, storage })
  return {
    address: walletInfo.address,
    mnemonic,
    privateKey: await exportPrivateKey(pin, storage),
    path,
    storage,
  }
}

/** Imports an existing key (e.g. the one in `apps/.env`) into the core. */
export async function importTestWallet(privateKey, { pin = TEST_PIN, chain = 'celoSepolia' } = {}) {
  const path = await tempWalletPath()
  const storage = new FileStorage(path)
  const walletInfo = await importWallet({ privateKey, pin, chain, storage })
  return {
    address: walletInfo.address,
    privateKey,
    path,
    storage,
  }
}

/** Re-opens a wallet created by `createTestWallet`/`importTestWallet`. */
export async function unlockTestWallet(path, pin = TEST_PIN) {
  const storage = new FileStorage(path)
  return unlockWallet(pin, storage)
}

export async function lockTestWallet() {
  await lockWallet()
}

export async function deleteTestWallet(path) {
  await deleteWallet(new FileStorage(path))
}

/** Signs a SIWE message with the unlocked core wallet. */
export async function signSIWEForTest(message) {
  return signSIWE(message)
}

/**
 * Installs a read-only-ish `window.ethereum` shim that signs through the core
 * wallet held in Node. Must be called before `page.goto()`.
 */
export async function installCoreWalletMock(page, { privateKey, address, chainId = 11142220, pin = TEST_PIN }) {
  const wallet = privateKey
    ? await importTestWallet(privateKey, { pin, chain: chainId === 42220 ? 'celo' : 'celoSepolia' })
    : await createTestWallet({ pin, chain: chainId === 42220 ? 'celo' : 'celoSepolia' })

  const selectedAddress = address || wallet.address
  const hexChainId = `0x${chainId.toString(16)}`

  // Bridge: the page asks Node (the core) for the signature.
  await page.exposeFunction('__pdjWalletSign', async (message) => signSIWEForTest(message))

  await page.evaluateOnNewDocument((addr, cid) => {
    const provider = {
      isMetaMask: true,
      isPdJWallet: false,
      chainId: cid,
      selectedAddress: addr,
      request: async ({ method, params }) => {
        if (method === 'eth_chainId') return cid
        if (method === 'eth_accounts') return [addr]
        if (method === 'eth_requestAccounts') return [addr]
        // The only method that really does something: signing is delegated to the
        // pdj-wallet core in Node.
        if (method === 'personal_sign') return window.__pdjWalletSign(params[0])
        if (method === 'eth_signTypedData_v4') return window.__pdjWalletSign(params[1])
        if (method === 'wallet_switchEthereumChain') return null
        if (method === 'wallet_addEthereumChain') return null
        if (method === 'eth_sendTransaction') return `0x${'cd'.repeat(32)}`
        if (method === 'eth_getBalance') return '0x0DE0B6B3A7640000'
        if (method === 'eth_blockNumber') return '0x1312D00'
        if (method === 'eth_gasPrice') return '0x12A05F20'
        if (method === 'eth_estimateGas') return '0x7A120'
        if (method === 'eth_call') {
          const data = params[0]?.data || ''
          return data.startsWith('0x70a08231')
            ? '0x00000000000000000000000000000000000000000000003635C9ADC5DEA00000'
            : `0x${'0'.repeat(64)}`
        }
        if (method === 'eth_getTransactionReceipt') {
          return { status: '0x1', blockNumber: '0x1312D01', logs: [], transactionHash: `0x${'cd'.repeat(32)}` }
        }
        return null
      },
      on: () => {},
      removeListener: () => {},
    }

    window.ethereum = provider
    const announce = () => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              uuid: crypto.randomUUID(),
              name: 'pdj-wallet core (E2E)',
              icon: '',
              rdns: 'app.pdj.wallet.e2e',
            },
            provider,
          },
        }),
      )
    }
    announce()
    window.addEventListener('load', announce)
  }, selectedAddress, hexChainId)

  return { ...wallet, address: selectedAddress }
}

/**
 * Signs in without clicking the UI: builds the SIWE message in Node, signs it
 * with the core and posts the callback inside the page so the NextAuth session
 * cookie lands in the browser jar (R-#233 Phase 2: the cookie is the credential).
 */
export async function signInWithCoreWallet(page, { privateKey, address, chainId = 11142220, baseUrl, pin = TEST_PIN }) {
  const wallet = privateKey
    ? await importTestWallet(privateKey, { pin, chain: chainId === 42220 ? 'celo' : 'celoSepolia' })
    : await createTestWallet({ pin, chain: chainId === 42220 ? 'celo' : 'celoSepolia' })

  // SIWE needs a checksummed address in the message; the app keeps the lowercase
  // form for its comparisons.
  const checksummed = getAddress(address || wallet.address)
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

  const signature = await signSIWEForTest(message)

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

  return { sessionAddress: checksummed.toLowerCase(), status: result.status, wallet }
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
