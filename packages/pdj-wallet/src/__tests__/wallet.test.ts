import { beforeEach, describe, expect, it } from 'vitest'
import { verifyMessage } from 'viem'
import {
  createWallet,
  deleteWallet,
  getWalletInfo,
  hasWallet,
  importWallet,
  isUnlocked,
  lockWallet,
  signMessage,
  unlockWallet,
} from '../wallet'
import { MemoryStorage } from '../storage/memory'
import { signSIWE } from '../siwe'

const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk'
const HARDHAT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const PIN = '123456'

describe('wallet', () => {
  let storage: MemoryStorage

  beforeEach(async () => {
    storage = new MemoryStorage()
    await lockWallet()
  })

  it('creates a wallet with a fresh mnemonic and stores it encrypted', async () => {
    const { walletInfo, mnemonic } = await createWallet({ pin: PIN, storage })
    expect(mnemonic.split(' ')).toHaveLength(12)
    expect(walletInfo.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(walletInfo.chain).toBe('celoSepolia')
    expect(await hasWallet(storage)).toBe(true)
    expect(isUnlocked()).toBe(true)
    const record = await storage.get()
    expect(record?.cipher.data).not.toContain(mnemonic)
    expect(record?.address).toBe(walletInfo.address)
  })

  it('rejects short PINs', async () => {
    await expect(createWallet({ pin: '123', storage })).rejects.toThrow(/at least 6 digits/i)
  })

  it('imports a known mnemonic and derives the expected address', async () => {
    const info = await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage })
    expect(info.address).toBe(HARDHAT_ADDRESS)
    await lockWallet()
    expect(await hasWallet(storage)).toBe(true)
    const unlocked = await unlockWallet(PIN, storage)
    expect(unlocked.address).toBe(HARDHAT_ADDRESS)
  })

  it('reports the wallet info without unlocking', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage })
    await lockWallet()
    const info = await getWalletInfo(storage)
    expect(info?.address).toBe(HARDHAT_ADDRESS)
    expect(isUnlocked()).toBe(false)
  })

  it('rejects a wrong PIN when unlocking', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage })
    await lockWallet()
    await expect(unlockWallet('999999', storage)).rejects.toThrow(/Wrong PIN/i)
  })

  it('signs messages only while unlocked', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage })
    const signature = await signMessage('hello')
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i)
    expect(await verifyMessage({ address: HARDHAT_ADDRESS, message: 'hello', signature })).toBe(true)
    await lockWallet()
    await expect(signMessage('hello')).rejects.toThrow(/locked/i)
  })

  it('signs SIWE messages that verify against the wallet address', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage })
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
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage })
    await deleteWallet(storage)
    expect(await hasWallet(storage)).toBe(false)
    expect(await getWalletInfo(storage)).toBeNull()
    expect(isUnlocked()).toBe(false)
    await expect(unlockWallet(PIN, storage)).rejects.toThrow(/no in-app wallet/i)
  })
})
