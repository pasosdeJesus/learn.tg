export {
  createWallet,
  importWallet,
  unlockWallet,
  lockWallet,
  deleteWallet,
  hasWallet,
  getWalletInfo,
  isUnlocked,
  getUnlockedAccount,
  getUnlockedInfo,
  signMessage,
  signTypedData,
  signTransaction,
} from './wallet'

export { signSIWE } from './siwe'
export { getInAppWalletProvider } from './provider'
export type { ProviderOptions } from './provider'

export {
  addressFromMnemonic,
  accountFromMnemonic,
  accountFromPrivateKey,
  newMnemonic,
  normalizeMnemonic,
  privateKeyFromMnemonic,
  type PrivateKey,
} from './signer'

export { encryptSecret, decryptSecret, KDF_ITERATIONS } from './crypto'

export { MemoryStorage } from './storage/memory'
export { IndexedDBStorage } from './storage/indexeddb'

export {
  CHAIN_IDS,
  DEFAULT_CHAIN,
  type ChainName,
  type CreateWalletOptions,
  type ImportWalletOptions,
  type StorageAdapter,
  type StoredWallet,
  type WalletInfo,
  type Eip1193Provider,
  type Eip1193RequestArgs,
} from './types'
