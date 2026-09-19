import { getAddress, isAddress } from 'viem'

/**
 * Pure helpers of the in-app wallet panel (R-#249): formatting, parsing and the
 * send validation. Kept out of the component so they can be unit-tested and so the
 * panel never decides these rules inline.
 */

export type SendToken = 'CELO' | 'USDT' | 'SLEARN'

/** Decimals the app already uses: CELO 18, USDT 6, SLEARN 2. */
export const TOKEN_DECIMALS: Record<SendToken, number> = { CELO: 18, USDT: 6, SLEARN: 2 }

/**
 * Formats a token amount for display, trimming trailing zeros and keeping at most
 * `maxFractionDigits` decimals (a 0.0001 USDT balance is not useful noise, but it
 * must not look like a real 0 either).
 */
export function formatTokenAmount(
  value: bigint | null | undefined,
  decimals: number,
  maxFractionDigits = 4,
): string {
  if (value === null || value === undefined) return '—'
  const negative = value < 0n
  const abs = negative ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const fraction = abs % base
  let fractionText = fraction.toString().padStart(decimals, '0').slice(0, maxFractionDigits)
  fractionText = fractionText.replace(/0+$/, '')
  const text = fractionText ? `${whole}.${fractionText}` : whole.toString()
  return negative ? `-${text}` : text
}

/**
 * Parses a user amount ("1", "0.5", ",5") into base units. Returns `null` when it
 * is not a positive number or has more decimals than the token supports (a common
 * way to silently send a different amount).
 */
export function parseTokenAmount(input: string, decimals: number): bigint | null {
  const raw = input.trim().replace(',', '.')
  if (!raw) return null
  if (!/^\d*\.?\d*$/.test(raw)) return null
  const [whole = '', fraction = ''] = raw.split('.')
  if (!whole && !fraction) return null
  if (fraction.length > decimals) return null
  const digits = `${whole || '0'}${fraction.padEnd(decimals, '0')}`
  try {
    const value = BigInt(digits)
    return value > 0n ? value : null
  } catch {
    return null
  }
}

export type SendError =
  | 'invalid-address'
  | 'invalid-amount'
  | 'insufficient'
  | 'self'
  | 'no-gas'
  | null

/**
 * Validates a transfer before asking the wallet to sign. `gasCost` is only used for
 * native CELO, where the amount plus the fee must fit in the balance.
 */
export function validateSend({
  to,
  amount,
  balance,
  isNative,
  selfAddress,
  gasCost = 0n,
}: {
  to: string
  amount: bigint | null
  balance: bigint | null
  isNative: boolean
  selfAddress?: string
  gasCost?: bigint
}): SendError {
  const value = to.trim()
  if (!isAddress(value)) return 'invalid-address'
  // A mixed-case address with a bad checksum is a typo: viem throws on getAddress.
  try {
    getAddress(value)
  } catch {
    return 'invalid-address'
  }
  if (selfAddress && value.toLowerCase() === selfAddress.toLowerCase()) return 'self'
  if (amount === null || amount <= 0n) return 'invalid-amount'
  if (balance === null) return 'insufficient'
  const needed = isNative ? amount + gasCost : amount
  if (needed > balance) return isNative ? 'no-gas' : 'insufficient'
  return null
}

/** `0x1234…abcd`, the shape used across the app. */
export function shortAddress(address: string): string {
  if (!address) return ''
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Base URL of the block explorer/Multibaas API for the configured network. */
export function explorerAddressBase(network: string | undefined): string {
  return network === 'celo' ? 'https://celo.blockscout.com' : 'https://celo-sepolia.blockscout.com'
}

/**
 * Blockscout v2 endpoint listing the NFTs of an address (Celo only, the scope of
 * the panel). No API key: the explorer is public.
 */
export function explorerApiNftsUrl(address: string, network: string | undefined): string {
  return `${explorerAddressBase(network)}/api/v2/addresses/${address}/nfts?type=ERC-721,ERC-1155`
}

/** Block explorer link for a transaction hash on the configured network. */
export function explorerTxUrl(hash: string, network: string | undefined): string {
  return `${explorerAddressBase(network)}/tx/${hash}`
}

/** Block explorer link for an address (used by the NFTs section and "receive"). */
export function explorerAddressUrl(address: string, network: string | undefined): string {
  return `${explorerAddressBase(network)}/address/${address}`
}
