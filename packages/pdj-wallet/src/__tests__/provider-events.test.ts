import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInAppWalletProvider } from '../provider'
import { importWallet, lockWallet } from '../wallet'
import { MemoryStorage } from '../storage/memory'

/**
 * R-#246 §14 item 3 + R-#236: una firma aprobada antes de que la billetera se
 * bloquee no se firma, y quien esté suscrito recibe `accountsChanged`/`disconnect`.
 *
 * Para provocar el bloqueo justo en medio de la petición se sustituye la
 * verificación del dispositivo por una que bloquea la billetera, y se simula un
 * sello biométrico presente (es lo que hace que `requireFundsConfirmation` espere
 * el gesto en vez de salir de inmediato).
 */
vi.mock('../biometric', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../biometric')>()
  return {
    ...actual,
    readBiometricRecord: async () => ({
      v: 1,
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      credentialId: 'cred-1',
      prfSalt: 'AAAA',
      hkdfSalt: 'AAAA',
      iv: 'AAAA',
      ciphertext: 'AAAA',
    }),
  }
})

vi.mock('../web-authn', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../web-authn')>()
  return {
    ...actual,
    assertUserVerification: async () => {
      // El usuario tarda, y en ese hueco la billetera se bloquea (auto-lock o ✕).
      await lockWallet()
    },
  }
})

const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk'
const HARDHAT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

describe('in-app provider events and mid-flight lock', () => {
  beforeEach(async () => {
    await lockWallet()
  })

  it('aborts the signature and notifies subscribers when the wallet locks mid-request', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: '12345678', storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    const accountsChanged: unknown[] = []
    const disconnects: unknown[] = []
    expect(provider.on('accountsChanged', (payload) => accountsChanged.push(payload))).toBe(provider)
    provider.on('disconnect', (payload) => disconnects.push(payload))

    await expect(
      provider.request({
        method: 'eth_signTypedData_v4',
        params: [HARDHAT_ADDRESS, JSON.stringify({ domain: {}, types: {}, message: {}, primaryType: 'X' })],
      }),
    ).rejects.toMatchObject({ code: 4001 })

    expect(accountsChanged).toEqual([[]])
    expect(disconnects).toHaveLength(1)
  })

  it('stops notifying a listener that was removed', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: '12345678', storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    const seen: unknown[] = []
    const listener = (payload: unknown) => seen.push(payload)
    provider.on('accountsChanged', listener)
    provider.removeListener('accountsChanged', listener)

    await provider
      .request({
        method: 'eth_signTypedData_v4',
        params: [HARDHAT_ADDRESS, JSON.stringify({ domain: {}, types: {}, message: {}, primaryType: 'X' })],
      })
      .catch(() => undefined)

    expect(seen).toEqual([])
  })
})
