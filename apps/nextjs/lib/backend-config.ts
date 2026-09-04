import { createPublicClient, createWalletClient, http, type Address } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { getSlearnAddress } from '@learn-tg/rewards/lib/deployments'
import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'

export function getChain() {
  return IS_PRODUCTION ? celo : celoSepolia
}

export function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
}

// Multi-RPC read/write list: forno (canonical) plus mirrors. forno sometimes
// lags indexing freshly-mined receipts, which made donation/purchase
// verification fail with "Transaction receipt ... could not be found" even
// though the transaction was mined. `fetchTxWithReceipt` round-robins these.
export function getRpcList(): string[] {
  const envUrl = process.env.NEXT_PUBLIC_RPC_URL
  const base = IS_PRODUCTION
    ? [
        'https://forno.celo.org',
        'https://rpc.ankr.com/celo',
        'https://celo.drpc.org',
        'https://celo-rpc.publicnode.com',
        'https://1rpc.io/celo',
      ]
    : [
        'https://forno.celo-sepolia.celo-testnet.org',
        'https://celo-sepolia.drpc.org',
        'https://celo-sepolia-rpc.publicnode.com',
      ]
  const urls = envUrl ? [envUrl, ...base.filter(u => u !== envUrl)] : base
  return urls
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

/**
 * Poll `getTransactionReceipt` + `getTransaction` across several RPCs until
 * the transaction is found or the timeout elapses. forno (canonical) can lag
 * indexing freshly-mined transactions; the mirrors (ankr, drpc, publicnode)
 * usually return the receipt immediately. Returns { receipt, tx }.
 */
export async function fetchTxWithReceipt(
  hash: `0x${string}`,
  timeoutMs = 120_000,
): Promise<{ receipt: any; tx: any }> {
  const chain = getChain()
  const clients = getRpcList().map(url =>
    createPublicClient({ chain, transport: http(url, { timeout: 10_000 }) }),
  )
  const deadline = Date.now() + timeoutMs
  let i = 0
  while (Date.now() < deadline) {
    const client = clients[i % clients.length]
    i++
    try {
      const receipt = await client.getTransactionReceipt({ hash })
      if (receipt) {
        const tx = await client.getTransaction({ hash })
        return { receipt, tx }
      }
    } catch {
      // receipt not indexed yet on this RPC — try the next one
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error(`Transaction receipt with hash "${hash}" could not be found after ${timeoutMs}ms`)
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
  const { receipt } = await fetchTxWithReceipt(hash)
  if (receipt.status !== 'success') {
    throw new Error(`Transaction reverted on-chain: ${hash}`)
  }
  return hash
}

/**
 * Envío de CELO nativo (donaciones de campaña en CELO, REQ/223): usa
 * sendTransaction (to + value) en vez de writeContract, y espera el receipt.
 */
export async function sendNativeTxAndWait(
  walletClient: any,
  publicClient: any,
  args: { to: Address; value: bigint; chain?: any; nonce?: number },
): Promise<`0x${string}`> {
  const { to, value, chain, nonce } = args
  const hash: `0x${string}` = await walletClient.sendTransaction({ to, value, chain, nonce })
  const { receipt } = await fetchTxWithReceipt(hash)
  if (receipt.status !== 'success') {
    throw new Error(`Transaction reverted on-chain: ${hash}`)
  }
  return hash
}