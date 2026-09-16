import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptSecret } from '../crypto'
import { FileStorage } from '../storage/file'
import { MemoryStorage } from '../storage/memory'
import {
  createWallet,
  deleteWallet,
  exportMnemonic,
  exportPrivateKey,
  getWalletInfo,
  hasWallet,
  importWallet,
  lockWallet,
  signMessage,
  unlockWallet,
} from '../wallet'
import { privateKeyFromMnemonic } from '../signer'
import type { StoredWallet } from '../types'

const PIN = '123456'
const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk'
const HARDHAT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const dirs: string[] = []

async function tempStorage(): Promise<{ storage: FileStorage; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'pdj-wallet-'))
  dirs.push(dir)
  const path = join(dir, 'wallet.json')
  return { storage: new FileStorage(path), path }
}

function sampleRecord(): StoredWallet {
  return {
    version: 1,
    address: HARDHAT_ADDRESS,
    chain: 'celoSepolia',
    createdAt: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: 'AA==' },
    cipher: { name: 'AES-GCM', iv: 'BB==', data: 'CC==' },
  }
}

afterEach(async () => {
  await lockWallet()
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) await rm(dir, { recursive: true, force: true })
  }
})

describe('FileStorage', () => {
  it('stores, reads and deletes the encrypted record', async () => {
    const { storage } = await tempStorage()

    expect(await storage.has()).toBe(false)
    expect(await storage.get()).toBeNull()

    await storage.set(sampleRecord())
    expect(await storage.has()).toBe(true)
    expect(await storage.get()).toEqual(sampleRecord())

    await storage.delete()
    expect(await storage.has()).toBe(false)
  })

  it('writes the file with owner-only permissions', async () => {
    const { storage, path } = await tempStorage()
    await storage.set(sampleRecord())

    const info = await stat(path)
    expect(info.mode & 0o777).toBe(0o600)
  })
})

describe('wallet with FileStorage (Node.js)', () => {
  it('creates, persists, unlocks and signs without a browser', async () => {
    const { storage } = await tempStorage()

    const { walletInfo, mnemonic } = await createWallet({ pin: PIN, storage })
    expect(walletInfo.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(mnemonic.split(' ')).toHaveLength(12)

    await lockWallet()
    expect(await hasWallet(storage)).toBe(true)
    expect(await hasWallet(new FileStorage('/nonexistent/pdj-wallet.json'))).toBe(false)

    expect((await getWalletInfo(storage))?.address).toBe(walletInfo.address)

    const unlocked = await unlockWallet(PIN, storage)
    expect(unlocked.address).toBe(walletInfo.address)

    const signature = await signMessage('hola')
    expect(signature).toMatch(/^0x[0-9a-f]+$/)

    await deleteWallet(storage)
    expect(await hasWallet(storage)).toBe(false)
  })

  it('exports the recovery phrase and the private key with the PIN', async () => {
    const { storage } = await tempStorage()
    const { mnemonic } = await createWallet({ pin: PIN, storage })

    expect(await exportMnemonic(PIN, storage)).toBe(mnemonic)
    expect(await exportPrivateKey(PIN, storage)).toMatch(/^0x[0-9a-f]{64}$/i)

    await expect(exportMnemonic('999999', storage)).rejects.toThrow(/PIN/)
    await expect(exportPrivateKey('999999', storage)).rejects.toThrow(/PIN/)
  })

  it('has no recovery phrase when the wallet was imported from a private key', async () => {
    const { storage } = await tempStorage()
    const privateKey = privateKeyFromMnemonic(HARDHAT_MNEMONIC)

    await importWallet({ privateKey, pin: PIN, storage })
    expect(await exportPrivateKey(PIN, storage)).toBe(privateKey)
    await expect(exportMnemonic(PIN, storage)).rejects.toThrow(/recovery phrase/)
  })
})

describe('legacy records', () => {
  it('unlocks a record whose ciphertext is the bare private key', async () => {
    const privateKey = privateKeyFromMnemonic(HARDHAT_MNEMONIC)
    const legacy = await encryptSecret(privateKey, PIN)
    const storage = new MemoryStorage({
      ...sampleRecord(),
      kdf: legacy.kdf,
      cipher: legacy.cipher,
    })

    const info = await unlockWallet(PIN, storage)
    expect(info.address.toLowerCase()).toBe(HARDHAT_ADDRESS.toLowerCase())

    // The old format cannot give back a recovery phrase.
    await expect(exportMnemonic(PIN, storage)).rejects.toThrow(/recovery phrase/)
  })
})
