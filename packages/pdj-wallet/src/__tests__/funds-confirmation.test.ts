import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let fakeIndexedDB: (() => void) | null = null
try {
  const mod = (await import('fake-indexeddb/auto')) as { default?: () => void }
  fakeIndexedDB = mod.default ?? (() => {})
} catch {
  fakeIndexedDB = null
}

const describeIdb = fakeIndexedDB ? describe : describe.skip

const PIN = '123456'
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
    await wallet.disableBiometricUnlock()
    await wallet.lockWallet()
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

  async function unlockWithPasskey() {
    const { importWallet, enableBiometricUnlock, lockWallet, unlockWithBiometric } = await import(
      '../wallet'
    )
    await importWallet({ privateKey: PN as `0x${string}`, pin: PIN })
    await enableBiometricUnlock(PIN)
    await lockWallet()
    await unlockWithBiometric()
  }

  it('asks the device to verify the user before broadcasting', async () => {
    const calls = installFakeAuthenticator()
    await unlockWithPasskey()
    const { getInAppWalletProvider } = await import('../provider')

    const hash = await getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!.request({
      method: 'eth_sendTransaction',
      params: [TX],
    })

    expect(hash).toBe('0x' + 'ab'.repeat(32))
    // Una aserción para mover fondos (además del `prf` del desbloqueo).
    expect(calls.filter((c) => c === 'assertion')).toHaveLength(1)
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

  it('rejects the transfer with 4001 when the user cancels the prompt', async () => {
    await unlockWithPasskey()
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
    await importWallet({ privateKey: PN as `0x${string}`, pin: PIN })
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
