// Unified E2E authentication helper.
// Injects a complete window.ethereum mock (EIP-1193 + EIP-6963 + real signing)
// and runs programmatic SIWE to establish a real session cookie.
//
// Usage:
//   import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
//   const { sessionAddress, authToken } = await setupE2EAuth(page, address, privateKey, chainId, baseUrl)
//   await page.goto(url)  // page is already authenticated

/**
 * Injects window.ethereum mock with EIP-6963 + real signing.
 * Must be called before page.goto().
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
        if (method === 'eth_getBalance') return '0x0DE0B6B3A7640000'
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
 */
export async function setupE2EAuth(page, address, privateKey, chainId, baseUrl) {
  await injectMock(page, address, privateKey, chainId)

  // Navigate to baseUrl so fetch() calls resolve to the right origin
  // Use networkidle0 to wait for HMR, fonts, etc.
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 })
  await new Promise(r => setTimeout(r, 2000))

  // Run SIWE programmatically inside the page
  const { SiweMessage } = await import('siwe')
  const { privateKeyToAccount } = await import('viem/accounts')
  const account = privateKeyToAccount(privateKey)
  const host = new URL(baseUrl).hostname
  const port = new URL(baseUrl).port || '443'
  const domainPort = port === '443' || port === '80' ? '' : `:${port}`

  // Get CSRF token
  const csrfRes = await page.evaluate(async () => {
    const r = await fetch('/api/auth/csrf')
    return r.json()
  })
  const csrfToken = csrfRes.csrfToken
  if (!csrfToken) throw new Error('Could not get CSRF token')

  // Build and sign SIWE message
  const domain = `${host}${domainPort}`
  const msg = new SiweMessage({
    domain,
    address: account.address,
    statement: 'Sign in to Learn through games.',
    uri: baseUrl,
    version: '1',
    chainId,
    nonce: csrfToken,
  })
  const msgStr = msg.prepareMessage()
  const sig = await account.signMessage({ message: msgStr })

  // POST callback via page.evaluate so cookie lands in browser jar
  const cbResult = await page.evaluate(async ({ csrfToken, msgStr, sig }) => {
    const body = new URLSearchParams({
      csrfToken,
      message: msgStr,
      signature: typeof sig === 'string' ? sig : sig.signature || String(sig),
      redirect: 'false',
      json: 'true',
    })
    const r = await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
    })
    const text = await r.text()
    return { ok: r.ok, status: r.status, body: text.slice(0, 80) }
  }, { csrfToken, msgStr, sig: typeof sig === 'string' ? sig : sig.signature || sig })

  console.log(`  SIWE: ${cbResult.status} — ${cbResult.body}`)

  // Store in localStorage for legacy compatibility
  if (cbResult.ok) {
    await page.evaluate(({ token, addr }) => {
      localStorage.setItem('learn.tg.authToken', token)
      localStorage.setItem('learn.tg.sessionAddress', addr)
    }, { token: csrfToken, addr: address.toLowerCase() })
  }

  return { sessionAddress: address.toLowerCase(), authToken: csrfToken }
}