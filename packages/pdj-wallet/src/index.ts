export {
  createWallet,
  importWallet,
  unlockWallet,
  lockWallet,
  deleteWallet,
  currentLockEpoch,
  hasWallet,
  getWalletInfo,
  isValidPassword,
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
  forgetBiometricCredential,
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
  USER_VERIFICATION_GRACE_MS,
  markUserVerified,
  clearUserVerification,
  hasRecentUserVerification,
  signalUnknownCredential,
  isUserCancelledError,
} from './web-authn.js'

export { signSIWE } from './siwe.js'
export {
  getInAppWalletProvider,
  extractDestination,
  requireFundsConfirmation,
  emitAccountsChanged,
} from './provider.js'
export type { ProviderOptions } from './provider.js'
export { isKnownDestination, rememberDestination, clearDestinations } from './destinations.js'

export {
  addressFromMnemonic,
  accountFromMnemonic,
  accountFromPrivateKey,
  assertValidMnemonic,
  isValidMnemonic,
  newMnemonic,
  normalizeMnemonic,
  privateKeyFromMnemonic,
  type PrivateKey,
} from './signer.js'

export {
  encryptSecret,
  decryptSecret,
  KDF_ITERATIONS,
  KDF_ITERATIONS_FLOOR,
  KDF_ITERATIONS_CEILING,
  KDF_BUDGET_MS,
  calibrateIterations,
  normalizePassword,
} from './crypto.js'

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
