import { decryptSecret, encryptSecret } from './crypto.js'
import { IndexedDBStorage } from './storage/indexeddb.js'
import {
  accountFromPrivateKey,
  newMnemonic,
  normalizeMnemonic,
  privateKeyFromMnemonic,
  type PrivateKey,
} from './signer.js'
import {
  CHAIN_IDS,
  DEFAULT_CHAIN,
  type ChainName,
  type CreateWalletOptions,
  type ImportWalletOptions,
  type StorageAdapter,
  type StoredWallet,
  type WalletInfo,
} from './types.js'

interface UnlockedState {
  privateKey: PrivateKey
  account: ReturnType<typeof accountFromPrivateKey>
  info: WalletInfo
}

/**
 * What is encrypted at rest. The recovery phrase is kept next to the private key
 * (it cannot be derived from it) so `exportMnemonic` can return it later; wallets
 * imported from a private key have no phrase.
 */
interface WalletSecret {
  v: 1
  privateKey: PrivateKey
  mnemonic?: string
}

function serializeSecret(privateKey: PrivateKey, mnemonic?: string): string {
  const secret: WalletSecret = mnemonic
    ? { v: 1, privateKey, mnemonic }
    : { v: 1, privateKey }
  return JSON.stringify(secret)
}

function parseSecret(plaintext: string): WalletSecret {
  // Compatibility: records created before this format stored the bare key.
  if (!plaintext.trimStart().startsWith('{')) {
    return { v: 1, privateKey: plaintext as PrivateKey }
  }
  const parsed = JSON.parse(plaintext) as Partial<WalletSecret>
  if (!parsed.privateKey) throw new Error('Corrupted wallet data')
  return { v: 1, privateKey: parsed.privateKey, mnemonic: parsed.mnemonic }
}

async function decryptRecord(record: StoredWallet, pin: string): Promise<WalletSecret> {
  const plaintext = await decryptSecret({ kdf: record.kdf, cipher: record.cipher }, pin)
  return parseSecret(plaintext)
}

let unlocked: UnlockedState | null = null

function browserStorage(): StorageAdapter {
  const idb = (globalThis as { indexedDB?: unknown }).indexedDB
  if (!idb) {
    throw new Error(
      'No storage available: pass a StorageAdapter (IndexedDBStorage is only available in the browser)',
    )
  }
  return new IndexedDBStorage()
}

function resolveStorage(storage?: StorageAdapter): StorageAdapter {
  return storage ?? browserStorage()
}

function assertPin(pin: string): void {
  if (typeof pin !== 'string' || !/^\d{6,}$/.test(pin)) {
    throw new Error('The PIN must have at least 6 digits')
  }
}

function assertChain(chain: ChainName | undefined): ChainName {
  const value = chain ?? DEFAULT_CHAIN
  if (!(value in CHAIN_IDS)) throw new Error(`Unsupported chain: ${String(chain)}`)
  return value
}

function buildRecord(
  address: `0x${string}`,
  chain: ChainName,
  createdAt: number,
  secret: { kdf: StoredWallet['kdf']; cipher: StoredWallet['cipher'] },
): StoredWallet {
  return { version: 1, address, chain, createdAt, kdf: secret.kdf, cipher: secret.cipher }
}

async function persist(
  storage: StorageAdapter,
  privateKey: PrivateKey,
  chain: ChainName,
  pin: string,
  mnemonic?: string,
): Promise<WalletInfo> {
  const account = accountFromPrivateKey(privateKey)
  const createdAt = Date.now()
  const secret = await encryptSecret(serializeSecret(privateKey, mnemonic), pin)
  const info: WalletInfo = { address: account.address, chain, createdAt }
  await storage.set(buildRecord(info.address, chain, createdAt, secret))
  unlocked = { privateKey, account, info }
  return info
}

export async function createWallet(
  options: CreateWalletOptions,
): Promise<{ walletInfo: WalletInfo; mnemonic: string }> {
  assertPin(options.pin)
  const chain = assertChain(options.chain)
  const storage = resolveStorage(options.storage)
  const mnemonic = newMnemonic()
  const privateKey = privateKeyFromMnemonic(mnemonic)
  const walletInfo = await persist(storage, privateKey, chain, options.pin, mnemonic)
  return { walletInfo, mnemonic }
}

export async function importWallet(options: ImportWalletOptions): Promise<WalletInfo> {
  assertPin(options.pin)
  if (!options.mnemonic && !options.privateKey) {
    throw new Error('Provide a mnemonic or a private key')
  }
  const chain = assertChain(options.chain)
  const storage = resolveStorage(options.storage)
  const mnemonic = options.mnemonic ? normalizeMnemonic(options.mnemonic) : undefined
  const privateKey = mnemonic
    ? privateKeyFromMnemonic(mnemonic)
    : (options.privateKey as PrivateKey)
  return persist(storage, privateKey, chain, options.pin, mnemonic)
}

export async function unlockWallet(pin: string, storage?: StorageAdapter): Promise<WalletInfo> {
  const adapter = resolveStorage(storage)
  const record = await adapter.get()
  if (!record) throw new Error('There is no in-app wallet to unlock')
  const secret = await decryptRecord(record, pin)
  const privateKey = secret.privateKey
  const account = accountFromPrivateKey(privateKey)
  if (account.address.toLowerCase() !== record.address.toLowerCase()) {
    throw new Error('The stored wallet does not match the decrypted key')
  }
  const info: WalletInfo = { address: record.address, chain: record.chain, createdAt: record.createdAt }
  unlocked = { privateKey, account, info }
  return info
}

export async function lockWallet(): Promise<void> {
  unlocked = null
}

export async function deleteWallet(storage?: StorageAdapter): Promise<void> {
  const adapter = resolveStorage(storage)
  await adapter.delete()
  unlocked = null
}

export async function hasWallet(storage?: StorageAdapter): Promise<boolean> {
  const adapter = resolveStorage(storage)
  return adapter.has()
}

export async function getWalletInfo(storage?: StorageAdapter): Promise<WalletInfo | null> {
  const adapter = resolveStorage(storage)
  const record = await adapter.get()
  if (!record) return null
  return { address: record.address, chain: record.chain, createdAt: record.createdAt }
}

/**
 * PIN-protected export. Both read the stored record with the PIN and have no
 * side effects on the session (the wallet may stay locked). The caller is
 * responsible for whatever it does with the secret.
 */
export async function exportPrivateKey(pin: string, storage?: StorageAdapter): Promise<`0x${string}`> {
  assertPin(pin)
  const adapter = resolveStorage(storage)
  const record = await adapter.get()
  if (!record) throw new Error('There is no in-app wallet to export')
  const secret = await decryptRecord(record, pin)
  return secret.privateKey
}

export async function exportMnemonic(pin: string, storage?: StorageAdapter): Promise<string> {
  assertPin(pin)
  const adapter = resolveStorage(storage)
  const record = await adapter.get()
  if (!record) throw new Error('There is no in-app wallet to export')
  const secret = await decryptRecord(record, pin)
  if (!secret.mnemonic) {
    throw new Error('This wallet was imported from a private key: it has no recovery phrase')
  }
  return secret.mnemonic
}

export function isUnlocked(): boolean {
  return unlocked !== null
}

export function getUnlockedAccount(): UnlockedState['account'] | null {
  return unlocked?.account ?? null
}

export function getUnlockedInfo(): WalletInfo | null {
  return unlocked?.info ?? null
}

function requireUnlocked(): UnlockedState {
  if (!unlocked) throw new Error('The in-app wallet is locked')
  return unlocked
}

export async function signMessage(message: string | { raw: `0x${string}` }): Promise<`0x${string}`> {
  return requireUnlocked().account.signMessage({ message }) as Promise<`0x${string}`>
}

export async function signTypedData(
  typedData: Parameters<UnlockedState['account']['signTypedData']>[0],
): Promise<`0x${string}`> {
  return requireUnlocked().account.signTypedData(typedData as never) as Promise<`0x${string}`>
}

export async function signTransaction(
  transaction: Parameters<UnlockedState['account']['signTransaction']>[0],
): Promise<`0x${string}`> {
  return requireUnlocked().account.signTransaction(transaction as never) as Promise<`0x${string}`>
}
