import { parseUnits, formatUnits, type Address } from 'viem'

export const erc20Abi = [
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'balance', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const

export function parseUserAmount(value: string, decimals: number): bigint {
  if (!/^\d*(\.|,)?\d*$/.test(value)) throw new Error('Invalid number')
  const normalized = value.replace(',', '.')
  if (normalized.trim() === '') return 0n
  return parseUnits(normalized as `${number}`, decimals)
}

export function parseUserAmountSafe(value: string, decimals: number): bigint {
  try { return parseUserAmount(value, decimals) }
  catch { return 0n }
}

export function formatDisplay(v: bigint, decimals: number): string {
  try {
    const num = Number(formatUnits(v, decimals))
    if (isNaN(num)) return '0'
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  } catch { return '0' }
}

export function safeParseFloat(v: string): number {
  return isNaN(parseFloat(v)) ? 0 : parseFloat(v)
}
