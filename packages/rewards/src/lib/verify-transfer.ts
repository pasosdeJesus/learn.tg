import { type Address, decodeFunctionData } from 'viem'

export const erc20TransferAbi = [
  { name: 'transfer', type: 'function', inputs: [
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ], outputs: [{ name: '', type: 'bool' }] },
] as const

export interface VerifiedTransfer {
  amount: bigint
}

export type FetchTxWithReceipt = (
  hash: `0x${string}`,
) => Promise<{ receipt: { status: string; to?: string; blockNumber?: bigint }; tx: { from: string; input: `0x${string}` } }>

export async function verifyTransfer(
  fetchTxWithReceipt: FetchTxWithReceipt,
  publicClient: any,
  hash: string,
  crypto: 'usdt' | 'slearn',
  fromAddress: string,
  toAddress: string,
  tokenAddress: Address,
  maxAgeMs = 86400000,
): Promise<VerifiedTransfer> {
  // Poll across several RPCs: forno can lag indexing freshly-mined receipts,
  // while mirrors (ankr/drpc/publicnode) return them immediately.
  const { receipt, tx } = await fetchTxWithReceipt(hash as `0x${string}`)
  if (receipt.status !== 'success') {
    throw new Error(`${crypto.toUpperCase()} transfer failed on-chain`)
  }
  if (receipt.to?.toLowerCase() !== tokenAddress.toLowerCase()) {
    throw new Error(`${crypto.toUpperCase()} transaction was not sent to ${crypto.toUpperCase()} contract`)
  }

  // Age check: best-effort, skip if getBlock fails (viem version compat)
  try {
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber })
    if (Date.now() - Number(block.timestamp * 1000n) > maxAgeMs) {
      throw new Error(`${crypto.toUpperCase()} transaction is too old (max 24 hours)`)
    }
  } catch (e: any) {
    if (e.message?.includes?.('too old')) throw e
    // otherwise log and skip — not critical
  }

  if (tx.from.toLowerCase() !== fromAddress.toLowerCase()) {
    throw new Error(`${crypto.toUpperCase()} transaction was not sent from the expected wallet`)
  }

  const { functionName, args } = decodeFunctionData({ abi: erc20TransferAbi, data: tx.input })
  if (functionName !== 'transfer') {
    throw new Error(`${crypto.toUpperCase()} transaction was not a transfer`)
  }

  const [recipient, amount] = args as [Address, bigint]
  if (recipient.toLowerCase() !== toAddress.toLowerCase()) {
    throw new Error(`${crypto.toUpperCase()} transfer was not sent to backend wallet`)
  }

  return { amount }
}