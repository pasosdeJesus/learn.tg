import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../storage/memory'

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

interface FakeAuthOptions {
  uv?: boolean
  createPrf?: boolean
  /** Makes the PRF result different, as if another credential answered. */
  corruptPrf?: boolean
}

/** Minimal stand-in for a platform authenticator with `prf`. */
function installFakeAuthenticator(options: FakeAuthOptions = {}): void {
  const { uv = true, createPrf = true, corruptPrf = false } = options

  class FakePublicKeyCredential {}
  ;(globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential = Object.assign(
    FakePublicKeyCredential,
    {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => uv,
      getClientCapabilities: async () => ({
        'extension:prf': true,
        userVerifyingPlatformAuthenticator: uv,
        passkeyPlatformAuthenticator: uv,
      }),
    },
  )

  const credential = {
    rawId: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
    getClientExtensionResults: () => ({ prf: { enabled: createPrf } }),
  }

  Object.defineProperty(globalThis.navigator, 'credentials', {
    configurable: true,
    value: {
      create: async () => credential,
      get: async (request: { publicKey?: { extensions?: { prf?: { eval?: { first?: ArrayBuffer } } } } }) => {
        const salt = request.publicKey?.extensions?.prf?.eval?.first
        // Determinista a partir de la sal: eso es lo que hace el autenticador real.
        const seed = new Uint8Array(salt ?? new Uint8Array([9, 9, 9]))
        if (corruptPrf) seed[0] = (seed[0] ?? 0) ^ 0xff
        const digest = await crypto.subtle.digest('SHA-256', seed)
        return {
          rawId: credential.rawId,
          getClientExtensionResults: () => ({ prf: { results: { first: digest } } }),
        }
      },
    },
  })
}

function removeAuthenticator(): void {
  delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential
  Object.defineProperty(globalThis.navigator, 'credentials', {
    configurable: true,
    value: undefined,
  })
}

describeIdb('biometric unlock (L2, R-#246)', () => {
  let storage: MemoryStorage

  beforeEach(async () => {
    storage = new MemoryStorage()
    const wallet = await import('../wallet')
    await wallet.disableBiometricUnlock()
    vi.resetModules()
    const fresh = await import('../wallet')
    await fresh.deleteWallet(new MemoryStorage()).catch(() => undefined)
    installFakeAuthenticator()
  })

  afterEach(() => {
    removeAuthenticator()
    vi.resetModules()
  })

  it('seals the key with the PRF secret so no plaintext is stored', async () => {
    const { importWallet, enableBiometricUnlock, hasBiometricUnlock } = await import('../wallet')
    const { readBiometricRecord } = await import('../biometric')

    await importWallet({ privateKey: PN as `0x${string}`, password: password, storage })
    await enableBiometricUnlock(password, storage)

    const record = await readBiometricRecord()
    expect(record).not.toBeNull()
    expect(JSON.stringify(record)).not.toContain(PN)
    expect(JSON.stringify(record)).not.toContain(PN.slice(2))
    expect(record!.address).toBe(ADDRESS)
    expect(record!.credentialId.length).toBeGreaterThan(0)
    expect(await hasBiometricUnlock(storage)).toBe(true)
  })

  it('unlocks with one gesture after the key was sealed', async () => {
    const { importWallet, enableBiometricUnlock, lockWallet, unlockWithBiometric, isUnlocked } =
      await import('../wallet')

    await importWallet({ privateKey: PN as `0x${string}`, password: password, storage })
    await enableBiometricUnlock(password, storage)
    await lockWallet()
    expect(isUnlocked()).toBe(false)

    const info = await unlockWithBiometric(storage)
    expect(info.address).toBe(ADDRESS)
    expect(isUnlocked()).toBe(true)
  })

  it('is deterministic: the same salt gives the same wrapped key across reloads', async () => {
    const { importWallet, enableBiometricUnlock, lockWallet } = await import('../wallet')
    await importWallet({ privateKey: PN as `0x${string}`, password: password, storage })
    await enableBiometricUnlock(password, storage)
    await lockWallet()

    // Otra "carga de página": módulo limpio, mismo almacenamiento y authenticator
    vi.resetModules()
    const fresh = await import('../wallet')
    const info = await fresh.unlockWithBiometric(storage)
    expect(info.address).toBe(ADDRESS)
  })

  it('keeps the password working as fallback and recovery', async () => {
    const { importWallet, enableBiometricUnlock, lockWallet, unlockWallet } = await import('../wallet')

    await importWallet({ privateKey: PN as `0x${string}`, password: password, storage })
    await enableBiometricUnlock(password, storage)
    await lockWallet()

    const info = await unlockWallet(password, storage)
    expect(info.address).toBe(ADDRESS)
  })

  it('rejects the gesture when the PRF result does not match (auth-failed)', async () => {
    const { importWallet, enableBiometricUnlock, lockWallet, unlockWithBiometric } = await import(
      '../wallet'
    )
    await importWallet({ privateKey: PN as `0x${string}`, password: password, storage })
    await enableBiometricUnlock(password, storage)
    await lockWallet()

    installFakeAuthenticator({ corruptPrf: true })
    await expect(unlockWithBiometric(storage)).rejects.toThrow('auth-failed')
  })

  it('reports no-prf instead of sealing when the authenticator has no prf', async () => {
    const { importWallet, enableBiometricUnlock, hasBiometricUnlock } = await import('../wallet')
    await importWallet({ privateKey: PN as `0x${string}`, password: password, storage })

    installFakeAuthenticator({ createPrf: false })
    await expect(enableBiometricUnlock(password, storage)).rejects.toThrow('no-prf')
    expect(await hasBiometricUnlock(storage)).toBe(false)
  })

  it('reports no-webauthn on devices without a platform authenticator', async () => {
    const { importWallet, enableBiometricUnlock, hasBiometricUnlock } = await import('../wallet')
    await importWallet({ privateKey: PN as `0x${string}`, password: password, storage })

    removeAuthenticator()
    await expect(enableBiometricUnlock(password, storage)).rejects.toThrow('no-webauthn')
    expect(await hasBiometricUnlock(storage)).toBe(false)
    // Y no revienta al consultar el estado
    expect(await hasBiometricUnlock(storage)).toBe(false)
  })

  it('forgets the sealed key on disable and on deleteWallet', async () => {
    const { importWallet, enableBiometricUnlock, disableBiometricUnlock, deleteWallet, hasBiometricUnlock } =
      await import('../wallet')

    await importWallet({ privateKey: PN as `0x${string}`, password: password, storage })
    await enableBiometricUnlock(password, storage)
    await disableBiometricUnlock()
    expect(await hasBiometricUnlock(storage)).toBe(false)

    await enableBiometricUnlock(password, storage)
    expect(await hasBiometricUnlock(storage)).toBe(true)
    await deleteWallet(storage)
    expect(await hasBiometricUnlock(storage)).toBe(false)
  })

  it('ignores a sealed key that belongs to another wallet', async () => {
    const { importWallet, enableBiometricUnlock, lockWallet, unlockWithBiometric, hasBiometricUnlock } =
      await import('../wallet')

    await importWallet({ privateKey: PN as `0x${string}`, password: password, storage })
    await enableBiometricUnlock(password, storage)
    await lockWallet()

    const other = new MemoryStorage()
    const OTHER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
    await importWallet({ privateKey: OTHER_KEY as `0x${string}`, password: password, storage: other })
    expect(await hasBiometricUnlock(other)).toBe(false)
    await expect(unlockWithBiometric(other)).rejects.toThrow('no-biometric')
  })
})
