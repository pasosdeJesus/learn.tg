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

export async function verifyTransfer(
  publicClient: any,
  hash: string,
  crypto: 'usdt' | 'slearn',
  fromAddress: string,
  toAddress: string,
  tokenAddress: Address,
  maxAgeMs = 86400000,
): Promise<VerifiedTransfer> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` })
  if (receipt.status !== 'success') {
    throw new Error(`${crypto.toUpperCase()} transfer failed on-chain`)
  }
  if (receipt.to?.toLowerCase() !== tokenAddress.toLowerCase()) {
    throw new Error(`${crypto.toUpperCase()} transaction was not sent to ${crypto.toUpperCase()} contract`)
  }

  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber })
  if (Date.now() - Number(block.timestamp * 1000n) > maxAgeMs) {
    throw new Error(`${crypto.toUpperCase()} transaction is too old (max 24 hours)`)
  }

  const tx = await publicClient.getTransaction({ hash: hash as `0x${string}` })
  if (tx.from.toLowerCase() !== fromAddress.toLowerCase()) {
    throw new Error(`${crypto.toUpperCase()} transaction was not sent from the expected wallet`)
  }

  const { functionName, args } = decodeFunctionData({ abi: erc20TransferAbi, data: tx.input })
  if (functionName !== 'transfer') {
    throw new Error(`${crypto.toUpperCase()} transaction was not a transfer`)
  }

  const [recipient, amount] = args as [Address, bigint]
  if (recipient.toLowerCase() !== toAddress.toLowerCase()) {
    throw new Error(`${crypto.toUpperCase()} transfer was not sent to the expected wallet`)
  }

  return { amount }
}