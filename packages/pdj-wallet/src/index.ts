export {
  createWallet,
  importWallet,
  unlockWallet,
  lockWallet,
  deleteWallet,
  hasWallet,
  getWalletInfo,
  enableBiometricUnlock,
  hasBiometricUnlock,
  unlockWithBiometric,
  disableBiometricUnlock,
  exportMnemonic,
  exportPrivateKey,
  isUnlocked,
  getUnlockedAccount,
  getUnlockedInfo,
  signMessage,
  signTypedData,
  signTransaction,
} from './wallet.js'

export {
  type BiometricRecord,
  readBiometricRecord,
  writeBiometricRecord,
  deleteBiometricRecord,
  sealWithPrfSecret,
  unsealWithPrfSecret,
} from './biometric.js'

export {
  detectPlatformSupport,
  createPrfCredential,
  evaluatePrf,
  deriveWrappingKey,
  type PlatformSupport,
  type PrfCredential,
} from './web-authn.js'

export { signSIWE } from './siwe.js'
export { getInAppWalletProvider } from './provider.js'
export type { ProviderOptions } from './provider.js'

export {
  addressFromMnemonic,
  accountFromMnemonic,
  accountFromPrivateKey,
  newMnemonic,
  normalizeMnemonic,
  privateKeyFromMnemonic,
  type PrivateKey,
} from './signer.js'

export { encryptSecret, decryptSecret, KDF_ITERATIONS } from './crypto.js'

export { MemoryStorage } from './storage/memory.js'
export { IndexedDBStorage } from './storage/indexeddb.js'

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
} from './types.js'
