import { createPublicClient, createWalletClient, http, type Address } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { getSlearnAddress } from '@/lib/deployments'
import { IS_PRODUCTION } from '@/lib/config'

export function getChain() {
  return IS_PRODUCTION ? celo : celoSepolia
}

export function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
}

export function getPublicClient() {
  return createPublicClient({ chain: getChain(), transport: http(getRpcUrl()) })
}

export function getWalletClient() {
  const privateKey = process.env.PRIVATE_KEY as string | undefined
  if (!privateKey) throw new Error('Backend private key not configured')
  const account = privateKeyToAccount(privateKey as Address)
  return createWalletClient({ account, chain: getChain(), transport: http(getRpcUrl()) })
}

export function getBackendWallet(): Address | undefined {
  return process.env.NEXT_PUBLIC_ADDRESS as Address | undefined
}

export function getBackendWalletLower(): string {
  return (process.env.NEXT_PUBLIC_ADDRESS || '').toLowerCase()
}

export async function getUsdtAddress(): Promise<Address | undefined> {
  const { USDT_ADDRESSES } = await import('@pasosdejesus/mpdj/blockchain/ecosystem-addresses')
  const chainKey = IS_PRODUCTION ? 'celo' : 'celoSepolia'
  return (USDT_ADDRESSES[chainKey] || process.env.NEXT_PUBLIC_USDT_ADDRESS) as Address | undefined
}

export function getUsdtDecimals(): number {
  return +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6)
}

export const MAX_TX_AGE = 24 * 60 * 60 * 1000 // 24 hours

export const SLEARN_RATE = 22
export const SLEARN_DECIMALS = 2

/**
 * Write a contract transaction, wait for its receipt, and throw if it
 * reverted on-chain. Prevents recording DB rows for transfers/payments
 * that never actually succeeded on-chain.
 */
export async function sendTxAndWait(
  walletClient: any,
  publicClient: any,
  args: any,
): Promise<`0x${string}`> {
  const hash = await walletClient.writeContract(args)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`Transaction reverted on-chain: ${hash}`)
  }
  return hash
}