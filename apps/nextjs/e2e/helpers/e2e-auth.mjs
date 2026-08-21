// Unified E2E authentication helper.
// Injects a complete window.ethereum mock (EIP-1193 + EIP-6963 + real RPC bridging)
// and runs programmatic SIWE to establish a real session cookie.
//
// Usage:
//   import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
//   const { sessionAddress, authToken } = await setupE2EAuth(page, address, privateKey, chainId, baseUrl)
//   await page.goto(url)  // page is already authenticated

/**
 * Injects window.ethereum mock with EIP-6963 + RPC bridging + real signing.
 * Must be called before page.goto().
 *
 * @param {import('puppeteer').Page} page
 * @param {string} address - Wallet address
 * @param {string} privateKey - Private key for signing
 * @param {number} chainId - Chain ID
 */
async function injectMock(page, address, privateKey, chainId) {
  const hexChainId = '0x' + chainId.toString(16)

  await page.exposeFunction('__signSiwe', async (message) => {
    const { privateKeyToAccount } = await import('viem/accounts')
    const account = privateKeyToAccount(privateKey)
    const sig = await account.signMessage({ message })
    return typeof sig === 'string' ? sig : sig.signature || sig
  })

  await page.evaluateOnNewDocument((addr, cid) => {
    const provider = {
      isMetaMask: true,
      chainId: cid,
      selectedAddress: addr,
      request: async ({ method, params }) => {
        if (method === 'eth_chainId') return cid
        if (method === 'eth_accounts') return [addr]
        if (method === 'eth_requestAccounts') return [addr]
        if (method === 'personal_sign') return window.__signSiwe(params[0])
        if (method === 'wallet_switchEthereumChain') return null
        if (method === 'wallet_addEthereumChain') return null
        if (method === 'eth_sendTransaction') return '0x' + 'cd'.repeat(32)
        if (method === 'eth_getBalance') return '0x0DE0B6B3A7640000' // 1 CELO
        if (method === 'eth_blockNumber') return '0x1312D00'
        if (method === 'eth_gasPrice') return '0x12A05F200'
        if (method === 'eth_estimateGas') return '0x7A120'
        if (method === 'eth_call') {
          const data = params[0]?.data || ''
          return data.startsWith('0x70a08231')
            ? '0x00000000000000000000000000000000000000000000003635C9ADC5DEA00000'
            : '0x0000000000000000000000000000000000000000000000000000000000000000'
        }
        if (method === 'eth_getTransactionReceipt') {
          return { status: '0x1', blockNumber: '0x1312D01', logs: [], transactionHash: '0x' + 'cd'.repeat(32) }
        }
        return null
      },
      on: () => {},
      removeListener: () => {},
    }

    window.ethereum = provider
    // EIP-6963 announce
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: {
        info: { uuid: crypto.randomUUID(), name: 'E2EMockWallet', icon: '', rdns: 'com.e2e.mock.wallet' },
        provider,
      },
    }))
    window.addEventListener('load', () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: {
          info: { uuid: crypto.randomUUID(), name: 'E2EMockWallet', icon: '', rdns: 'com.e2e.mock.wallet' },
          provider,
        },
      }))
    })
  }, address, hexChainId)
}

/**
 * Sets up E2E auth: injects wallet mock and runs programmatic SIWE.
 * Call before page.goto().
 *
 * @param {import('puppeteer').Page} page
 * @param {string} address
 * @param {string} privateKey
 * @param {number} chainId
 * @param {string} baseUrl
 * @returns {Promise<{sessionAddress: string, authToken: string}>}
 */
export async function setupE2EAuth(page, address, privateKey, chainId, baseUrl) {
  await injectMock(page, address, privateKey, chainId)

  // Navigate to target so fetch() resolves
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))

  // Run programmatic SIWE via the framework's simulateSIWE
  const { simulateSIWE } = await import('@pasosdejesus/m/e2e')
  const host = new URL(baseUrl).hostname
  const port = new URL(baseUrl).port || '443'
  const domainPort = port === '443' || port === '80' ? '' : `:${port}`

  const { privateKeyToAccount } = await import('viem/accounts')
  const account = privateKeyToAccount(privateKey)

  const ok = await simulateSIWE(page, {
    account,
    host,
    domainPort,
    base: baseUrl,
    chainId,
    statement: 'Sign in to Learn through games.',
  })

  if (!ok) console.warn('[setupE2EAuth] SIWE returned non-200')

  const authToken = await page.evaluate(() => localStorage.getItem('learn.tg.authToken') || '')
  return { sessionAddress: address.toLowerCase(), authToken }
}