import { beforeEach, describe, expect, it } from 'vitest'
import { verifyMessage } from 'viem'
import {
  createWallet,
  deleteWallet,
  getWalletInfo,
  hasWallet,
  importWallet,
  isUnlocked,
  isValidPassword,
  lockWallet,
  signMessage,
  unlockWallet,
} from '../wallet'
import { MemoryStorage } from '../storage/memory'
import { KDF_ITERATIONS_FLOOR, encryptSecret } from '../crypto'
import { privateKeyFromMnemonic } from '../signer'
import { isValidMnemonic } from '../signer'
import { signSIWE } from '../siwe'

const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk'
const HARDHAT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const password = '12345678'

describe('wallet', () => {
  let storage: MemoryStorage

  beforeEach(async () => {
    storage = new MemoryStorage()
    await lockWallet()
  })

  it('creates a wallet with a fresh mnemonic and stores it encrypted', async () => {
    const { walletInfo, mnemonic } = await createWallet({ password: password, storage })
    expect(mnemonic.split(' ')).toHaveLength(12)
    expect(walletInfo.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(walletInfo.chain).toBe('celoSepolia')
    expect(await hasWallet(storage)).toBe(true)
    expect(isUnlocked()).toBe(true)
    const record = await storage.get()
    expect(record?.cipher.data).not.toContain(mnemonic)
    expect(record?.address).toBe(walletInfo.address)
  })

  it('rejects a password shorter than 8 characters', async () => {
    await expect(createWallet({ password: '123', storage })).rejects.toThrow(
      /at least 8 characters/i,
    )
    await expect(createWallet({ password: 'short', storage })).rejects.toThrow(
      /at least 8 characters/i,
    )
    // El password numérico corto (6 dígitos) ya no se acepta (R-#251, nada en producción).
    await expect(createWallet({ password: '123456', storage })).rejects.toThrow(
      /at least 8 characters/i,
    )
  })

  // R-#251: la billetera se protege con una clave de 8+ caracteres y se desbloquea
  // con ella.
  // R-#251: un registro viejo (o creado en un equipo más rápido/más lento) se
  // vuelve a cifrar al desbloquear si quedó por debajo del objetivo del dispositivo.
  it('upgrades the work factor of an old record when it is unlocked', async () => {
    const legacy = new MemoryStorage()
    const secret = await encryptSecret(
      JSON.stringify({ v: 1, privateKey: privateKeyFromMnemonic(HARDHAT_MNEMONIC) }),
      password,
      1000,
    )
    await legacy.set({
      version: 1,
      address: HARDHAT_ADDRESS,
      chain: 'celoSepolia',
      createdAt: Date.now(),
      kdf: secret.kdf,
      cipher: secret.cipher,
    })

    expect((await unlockWallet(password, legacy)).address).toBe(HARDHAT_ADDRESS)

    const upgraded = await legacy.get()
    expect(upgraded!.kdf.iterations).toBeGreaterThanOrEqual(KDF_ITERATIONS_FLOOR)
    // Y sigue abriendo con la misma clave después del re-cifrado.
    await lockWallet()
    expect((await unlockWallet(password, legacy)).address).toBe(HARDHAT_ADDRESS)
  })
  it('accepts a passphrase of 8+ characters and unlocks with it', async () => {
    const { walletInfo } = await createWallet({ password: 'correct horse', storage })
    expect(walletInfo.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    await lockWallet()
    const unlocked = await unlockWallet('correct horse', storage)
    expect(unlocked.address).toBe(walletInfo.address)
  })

  it('isValidPassword accepts 8+ character secrets only', () => {
    expect(isValidPassword('12345678')).toBe(true)
    expect(isValidPassword('correct horse')).toBe(true)
    expect(isValidPassword('123456')).toBe(false)
    expect(isValidPassword('short')).toBe(false)
    expect(isValidPassword('  short  ')).toBe(false)
  })

  it('imports a known mnemonic and derives the expected address', async () => {
    const info = await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    expect(info.address).toBe(HARDHAT_ADDRESS)
    await lockWallet()
    expect(await hasWallet(storage)).toBe(true)
    const unlocked = await unlockWallet(password, storage)
    expect(unlocked.address).toBe(HARDHAT_ADDRESS)
  })

  // Sin `validateMnemonic`, `mnemonicToSeedSync` acepta una frase con un error de
  // dedo o de checksum y deriva otra billetera (vacía) sin avisar.
  it('rejects a mnemonic that is not BIP39', async () => {
    const typo = 'test test test test test test test test test test test tset'
    await expect(importWallet({ mnemonic: typo, password: password, storage })).rejects.toThrow(/invalid-mnemonic/)
    expect(await hasWallet(storage)).toBe(false)

    // Misma palabra 12 veces: todas están en la lista, el checksum no cuadra.
    const badChecksum = 'test test test test test test test test test test test test'
    await expect(importWallet({ mnemonic: badChecksum, password: password, storage })).rejects.toThrow(/invalid-mnemonic/)

    // 11 palabras: longitud inválida.
    await expect(
      importWallet({ mnemonic: HARDHAT_MNEMONIC.split(' ').slice(0, 11).join(' '), password: password, storage }),
    ).rejects.toThrow(/invalid-mnemonic/)
  })

  it('accepts the phrases it generates and a valid 24-word phrase', async () => {
    const { mnemonic } = await createWallet({ password: password, storage })
    expect(await isValidMnemonic(mnemonic)).toBe(true)
    expect(await isValidMnemonic(`  ${HARDHAT_MNEMONIC.toUpperCase()}  `)).toBe(true)
    expect(await isValidMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art')).toBe(true)
    expect(await isValidMnemonic('not a mnemonic at all')).toBe(false)
  })

  it('reports the wallet info without unlocking', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    await lockWallet()
    const info = await getWalletInfo(storage)
    expect(info?.address).toBe(HARDHAT_ADDRESS)
    expect(isUnlocked()).toBe(false)
  })

  it('rejects a wrong password when unlocking', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    await lockWallet()
    await expect(unlockWallet('99999999', storage)).rejects.toThrow(/Wrong password/i)
  })

  it('signs messages only while unlocked', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    const signature = await signMessage('hello')
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i)
    expect(await verifyMessage({ address: HARDHAT_ADDRESS, message: 'hello', signature })).toBe(true)
    await lockWallet()
    await expect(signMessage('hello')).rejects.toThrow(/locked/i)
  })

  it('signs SIWE messages that verify against the wallet address', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    const message = [
      'learn.tg:9001 wants you to sign in with your Ethereum account:',
      HARDHAT_ADDRESS,
      '',
      'Sign in to Learn Through Games.',
      '',
      'URI: https://learn.tg:9001',
      'Version: 1',
      'Chain ID: 11142220',
      'Nonce: 12345678',
      'Issued At: 2026-09-15T00:00:00.000Z',
    ].join('\n')
    const signature = await signSIWE(message)
    expect(await verifyMessage({ address: HARDHAT_ADDRESS, message, signature })).toBe(true)
  })

  it('deletes the wallet and locks it', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    await deleteWallet(storage)
    expect(await hasWallet(storage)).toBe(false)
    expect(await getWalletInfo(storage)).toBeNull()
    expect(isUnlocked()).toBe(false)
    await expect(unlockWallet(password, storage)).rejects.toThrow(/no in-app wallet/i)
  })
})
