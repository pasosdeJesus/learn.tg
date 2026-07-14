// SIWE-capable wallet mock for Puppeteer E2E tests.
//
// Injects via evaluateOnNewDocument so it survives page reloads.
// Uses page.exposeFunction to bridge browser → Node.js for real signing.
//
// Usage:
//   const page = await browser.newPage()
//   await setupSIWEMock(page, address, privateKey, chainId)
//   await page.goto(url)  // mock is ready before any page script runs

export async function setupSIWEMock(page, address, privateKey, chainId = 11142220) {
  const hexChainId = '0x' + chainId.toString(16)

  // Set up signing bridge BEFORE page loads
  await page.exposeFunction('__signSiwe', async (message) => {
    const { privateKeyToAccount } = await import('viem/accounts')
    const account = privateKeyToAccount(privateKey)
    const sig = await account.signMessage({ message })
    return sig.signature || sig
  })

  // Inject full wallet mock BEFORE any page script runs
  // This survives page reloads (evaluateOnNewDocument)
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
          // Call back to Node.js for real ECDSA signing
          return window.__signSiwe(params[0])
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
