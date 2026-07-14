// SIWE-capable wallet mock for Puppeteer E2E tests.
//
// Unlike the basic mock in @pasosdejesus/m/e2e, this one signs
// personal_sign messages with a REAL private key using viem in Node.js.
// The browser mock calls back to Node via page.exposeFunction.
//
// Usage in spec:
//   import { injectSIWEWallet } from '../../e2e/helpers/siwe-wallet-mock.mjs'
//   await injectSIWEWallet(page, account.address, accountPrivateKey, chainId)

/**
 * Injects a window.ethereum mock that signs personal_sign messages
 * with a real private key. Uses page.exposeFunction to bridge
 * browser → Node.js for signing.
 */
export async function injectSIWEWallet(page, address, privateKey, chainId = 11142220) {
  const hexChainId = '0x' + chainId.toString(16)

  // Expose signing function to the browser
  await page.exposeFunction('__signMessage', async (message) => {
    const { privateKeyToAccount } = await import('viem/accounts')
    const account = privateKeyToAccount(privateKey)
    const sig = await account.signMessage({ message })
    return sig.signature || sig
  })

  // Inject wallet mock that calls the exposed signing function
  await page.evaluateOnNewDocument((addr, cid) => {
    window.ethereum = {
      isMetaMask: true,
      chainId: cid,
      selectedAddress: addr,
      request: async ({ method, params }) => {
        if (method === 'eth_chainId') return cid
        if (method === 'eth_accounts') return [addr]
        if (method === 'eth_requestAccounts') return [addr]
        if (method === 'personal_sign') {
          const message = params[0]
          // Call back to Node.js for real signing
          return window.__signMessage(message)
        }
        if (method === 'wallet_switchEthereumChain') return null
        if (method === 'eth_sendTransaction') return '0x' + 'cd'.repeat(32)
        return null
      },
      on: (_event, _listener) => {},
      removeListener: (_event, _listener) => {},
    }
  }, address, hexChainId)
}
