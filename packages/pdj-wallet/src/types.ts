export type ChainName = 'celo' | 'celoSepolia'

export const CHAIN_IDS: Record<ChainName, number> = {
  celo: 42220,
  celoSepolia: 11142220,
}

export const DEFAULT_CHAIN: ChainName = 'celoSepolia'

export interface WalletInfo {
  address: `0x${string}`
  chain: ChainName
  createdAt: number
}

export interface StoredWallet {
  version: 1
  address: `0x${string}`
  chain: ChainName
  createdAt: number
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    iv: string
    data: string
  }
}

export interface StorageAdapter {
  get(): Promise<StoredWallet | null>
  set(record: StoredWallet): Promise<void>
  delete(): Promise<void>
  has(): Promise<boolean>
}

export interface CreateWalletOptions {
  pin: string
  chain?: ChainName
  storage?: StorageAdapter
}

export interface ImportWalletOptions {
  mnemonic?: string
  privateKey?: `0x${string}`
  pin: string
  chain?: ChainName
  storage?: StorageAdapter
}

export interface InAppWallet {
  address: `0x${string}`
  chain: ChainName
  createdAt: number
  account: {
    address: `0x${string}`
    signMessage(args: { message: string | { raw: `0x${string}` } }): Promise<`0x${string}`>
    signTransaction(tx: Record<string, unknown>): Promise<`0x${string}`>
    signTypedData(typedData: Record<string, unknown>): Promise<`0x${string}`>
  }
}

export interface Eip1193RequestArgs {
  method: string
  params?: unknown[] | Record<string, unknown>
}

export type Eip1193Provider = {
  request(args: Eip1193RequestArgs): Promise<unknown>
  on?(event: string, handler: (...args: unknown[]) => void): void
  removeListener?(event: string, handler: (...args: unknown[]) => void): void
  isPdJWallet?: true
}
