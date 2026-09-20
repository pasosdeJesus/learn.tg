import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let fakeIndexedDB: (() => void) | null = null
try {
  const mod = (await import('fake-indexeddb/auto')) as { default?: () => void }
  fakeIndexedDB = mod.default ?? (() => {})
} catch {
  fakeIndexedDB = null
}

const describeIdb = fakeIndexedDB ? describe : describe.skip

const password = '12345678'
const PN = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
// Transacción legacy válida (lo único que viem puede serializar sin RPC).
const TX = {
  to: ADDRESS,
  value: '0x1',
  gas: '0x5208',
  gasPrice: '0x1',
  nonce: '0x0',
  chainId: 11142220,
}

// Autorización EIP-712 del tipo que usa USDC (EIP-3009): mueve fondos sin pasar
// por `eth_sendTransaction`.
const TYPED_DATA = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
    ],
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
  },
  primaryType: 'TransferWithAuthorization',
  domain: { name: 'USDC', version: '2', chainId: 11142220 },
  message: { from: ADDRESS, to: ADDRESS, value: '1' },
}

/** Authenticator falso que registra cada pedido de verificación. */
function installFakeAuthenticator({ reject = false } = {}) {
  const calls: string[] = []
  class FakePublicKeyCredential {}
  ;(globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential = Object.assign(
    FakePublicKeyCredential,
    {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
      getClientCapabilities: async () => ({ 'extension:prf': true }),
    },
  )
  Object.defineProperty(globalThis.navigator, 'credentials', {
    configurable: true,
    value: {
      create: async () => ({
        rawId: new Uint8Array([9, 9, 9]).buffer,
        getClientExtensionResults: () => ({ prf: { enabled: true } }),
      }),
      get: async (request: {
        publicKey?: { challenge?: ArrayBuffer; extensions?: { prf?: { eval?: { first?: ArrayBuffer } } } }
      }) => {
        const salt = request.publicKey?.extensions?.prf?.eval?.first
        calls.push(salt ? 'prf' : 'assertion')
        if (reject) throw Object.assign(new Error('cancelled'), { name: 'NotAllowedError' })
        // Con `prf` el resultado depende de la sal (determinista), como el real.
        const seed = new Uint8Array(salt ?? request.publicKey?.challenge ?? new ArrayBuffer(4))
        const digest = await crypto.subtle.digest('SHA-256', seed)
        return {
          rawId: new Uint8Array([9, 9, 9]).buffer,
          getClientExtensionResults: () => ({ prf: { results: { first: digest } } }),
        }
      },
    },
  })
  return calls
}

describeIdb('confirmación de fondos (L1, R-#246)', () => {
  beforeEach(async () => {
    const wallet = await import('../wallet')
    const { clearDestinations } = await import('../destinations')
    await wallet.disableBiometricUnlock()
    await wallet.lockWallet()
    clearDestinations()
    installFakeAuthenticator()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ result: '0x' + 'ab'.repeat(32) }),
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential
    Object.defineProperty(globalThis.navigator, 'credentials', { configurable: true, value: undefined })
  })

  async function unlockWithPasskey({ clear = false }: { clear?: boolean } = {}) {
    const { importWallet, enableBiometricUnlock, lockWallet, unlockWithBiometric } = await import(
      '../wallet'
    )
    const { clearUserVerification } = await import('../web-authn')
    await importWallet({ privateKey: PN as `0x${string}`, password: password })
    await enableBiometricUnlock(password)
    await lockWallet()
    await unlockWithBiometric()
    // El desbloqueo L2 abre la ventana de gracia (decisión 2026-09-20). Los tests
    // que esperan el gesto de L1 la cierran primero, como si hubiera expirado.
    if (clear) clearUserVerification()
  }

  it('asks the device to verify the user before broadcasting (grace expired)', async () => {
    const calls = installFakeAuthenticator()
    await unlockWithPasskey({ clear: true })
    const { getInAppWalletProvider } = await import('../provider')

    const hash = await getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!.request({
      method: 'eth_sendTransaction',
      params: [TX],
    })

    expect(hash).toBe('0x' + 'ab'.repeat(32))
    // Una aserción para mover fondos (además del `prf` del desbloqueo).
    expect(calls.filter((c) => c === 'assertion')).toHaveLength(1)
  })

  // Usabilidad sobre seguridad (R-#253, 15 min): un destino **ya conocido** no
  // vuelve a pedir gesto dentro de la ventana.
  it('does not ask again within the grace window for a known destination', async () => {
    const calls = installFakeAuthenticator()
    await unlockWithPasskey()
    const { rememberDestination } = await import('../destinations')
    rememberDestination(ADDRESS, TX.to)
    const { getInAppWalletProvider } = await import('../provider')

    const hash = await getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!.request({
      method: 'eth_sendTransaction',
      params: [TX],
    })

    expect(hash).toBe('0x' + 'ab'.repeat(32))
    expect(calls.filter((c) => c === 'assertion')).toHaveLength(0)
  })

  // R-#253: un destino **nuevo** exige el gesto aunque la ventana esté abierta.
  it('asks for the gesture for a new destination even inside the grace window', async () => {
    const calls = installFakeAuthenticator()
    await unlockWithPasskey()
    const { getInAppWalletProvider } = await import('../provider')

    await getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!.request({
      method: 'eth_sendTransaction',
      params: [TX],
    })

    expect(calls.filter((c) => c === 'assertion')).toHaveLength(1)
    // Y queda recordado: el siguiente envío a la misma dirección ya no pregunta.
    const { isKnownDestination } = await import('../destinations')
    expect(isKnownDestination(ADDRESS, TX.to)).toBe(true)
  })

  it('does not gate reads or signatures that do not move funds', async () => {
    const calls = installFakeAuthenticator()
    await unlockWithPasskey()
    const { getInAppWalletProvider } = await import('../provider')
    const provider = getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!

    await provider.request({ method: 'eth_accounts' })
    await provider.request({ method: 'personal_sign', params: ['0xdeadbeef', ADDRESS] })

    expect(calls.filter((c) => c === 'assertion')).toHaveLength(0)
  })

  // R-#246 §10: una autorización EIP-712 fuera de `eth_sendTransaction`
  // (EIP-2612 / EIP-3009 de USDC) o una firma cruda también mueven fondos.
  it('asks for the gesture before signing typed data (grace expired)', async () => {
    const calls = installFakeAuthenticator()
    await unlockWithPasskey({ clear: true })
    const { getInAppWalletProvider } = await import('../provider')

    const signature = await getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!.request({
      method: 'eth_signTypedData_v4',
      params: [ADDRESS, JSON.stringify(TYPED_DATA)],
    })

    expect(signature).toMatch(/^0x[0-9a-f]+$/i)
    expect(calls.filter((c) => c === 'assertion')).toHaveLength(1)
  })

  it('asks for the gesture before signing a raw transaction (grace expired)', async () => {
    const calls = installFakeAuthenticator()
    await unlockWithPasskey({ clear: true })
    const { getInAppWalletProvider } = await import('../provider')

    const raw = await getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!.request({
      method: 'eth_signTransaction',
      params: [TX],
    })

    expect(raw).toMatch(/^0x[0-9a-f]+$/i)
    expect(calls.filter((c) => c === 'assertion')).toHaveLength(1)
  })

  it('rejects typed data with 4001 when the user cancels the prompt', async () => {
    await unlockWithPasskey({ clear: true })
    installFakeAuthenticator({ reject: true })
    const { getInAppWalletProvider } = await import('../provider')

    await expect(
      getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!.request({
        method: 'eth_signTypedData_v4',
        params: [ADDRESS, JSON.stringify(TYPED_DATA)],
      }),
    ).rejects.toMatchObject({ code: 4001 })
  })

  it('rejects the transfer with 4001 when the user cancels the prompt', async () => {
    await unlockWithPasskey({ clear: true })
    installFakeAuthenticator({ reject: true })
    const { getInAppWalletProvider } = await import('../provider')

    await expect(
      getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!.request({
        method: 'eth_sendTransaction',
        params: [TX],
      }),
    ).rejects.toMatchObject({ code: 4001 })
    // Y no se transmitió nada.
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('moves funds without a gesture when no passkey is enrolled', async () => {
    installFakeAuthenticator()
    const { importWallet } = await import('../wallet')
    await importWallet({ privateKey: PN as `0x${string}`, password: password })
    const { getInAppWalletProvider } = await import('../provider')

    await getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!.request({
      method: 'eth_sendTransaction',
      params: [TX],
    })
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('can be disabled for tests and internal callers', async () => {
    await unlockWithPasskey()
    installFakeAuthenticator({ reject: true })
    const { getInAppWalletProvider } = await import('../provider')

    await getInAppWalletProvider({
      rpcUrl: 'https://rpc.example',
      requireUserVerification: false,
    })!.request({ method: 'eth_sendTransaction', params: [TX] })
    expect(globalThis.fetch).toHaveBeenCalled()
  })
})
