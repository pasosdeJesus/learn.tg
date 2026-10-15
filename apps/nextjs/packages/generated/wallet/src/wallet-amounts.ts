/**
 * Helpers puros del panel de billetera ([REQ/50](https://gitlab.com/pasosdeJesus/m/-/work_items/50) V; portados **casi literalmente** de
 * learn.tg `lib/wallet-amounts.ts`, R-#249): formateo, parseo, validación de envío y
 * helpers de explorer. Fuera del componente para poder probarlos y para que el panel
 * no decida estas reglas inline.
 *
 * Lo específico de learn.tg (lista de tokens, red Celo, direcciones por env) se
 * **inyecta** desde el consumidor; aquí queda la lógica genérica.
 */

import { getAddress, isAddress } from 'viem'

/**
 * Formatea un monto para mostrar, quitando ceros finales y dejando a lo más
 * `maxFractionDigits` decimales (un saldo de 0.0001 USDT no es ruido útil, pero no
 * debe verse como un 0 real).
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
 * Parsea un monto escrito por el usuario ("1", "0.5", ",5") a unidades base.
 * Devuelve `null` si no es un positivo o tiene más decimales de los que el token
 * soporta (una forma habitual de enviar un monto distinto sin notarlo).
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
  | 'unknown-balance'
  | 'insufficient'
  | 'self'
  | 'no-gas'
  | null

/**
 * Valida una transferencia antes de pedir la firma. `gasCost` sólo se usa para la
 * moneda nativa, donde el monto más la comisión deben caber en el saldo.
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
  // Una dirección con checksum mal formado es un error de tipeo: viem lanza en getAddress.
  try {
    getAddress(value)
  } catch {
    return 'invalid-address'
  }
  if (selfAddress && value.toLowerCase() === selfAddress.toLowerCase()) return 'self'
  if (amount === null || amount <= 0n) return 'invalid-amount'
  // Saldo **desconocido** (aún cargando o lectura fallida) no es "insuficiente" (V1).
  if (balance === null) return 'unknown-balance'
  const needed = isNative ? amount + gasCost : amount
  if (needed > balance) return isNative ? 'no-gas' : 'insufficient'
  return null
}

/** `0x1234…abcd`, la forma usada en toda la app. */
export function shortAddress(address: string): string {
  if (!address) return ''
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** `getAddress` lanza con una dirección mal formada; el panel no debe caerse. */
export function checksummed(address: string): string {
  try {
    return getAddress(address)
  } catch {
    return address
  }
}

/**
 * Base del explorer/API Multibaas. Por defecto Celo (el alcance de learn.tg); un
 * consumidor de otra red pasa `base`.
 */
export function explorerAddressBase(network: string | undefined, base?: string): string {
  if (base) return base
  return network === 'celo' ? 'https://celo.blockscout.com' : 'https://celo-sepolia.blockscout.com'
}

/**
 * Endpoint Blockscout v2 con los NFT de una dirección. La ruta es **`/nft`**
 * (singular) con `type` como lista: `/nfts` responde **400**.
 */
export function explorerApiNftsUrl(address: string, network: string | undefined, base?: string): string {
  const safe = encodeURIComponent(checksummed(address))
  return `${explorerAddressBase(network, base)}/api/v2/addresses/${safe}/nft?type=ERC-721,ERC-1155`
}

/**
 * Algunos `image` de metadatos son URIs que el navegador no puede pedir directo
 * (`ipfs://…`, `ar://…`): se mapean a una pasarela HTTPS. Lo demás pasa igual.
 */
export function normalizeNftImage(image: string | undefined | null): string | undefined {
  if (!image) return undefined
  const ipfs = /^ipfs:\/\/(?:ipfs\/)?(.+)$/i.exec(image)
  if (ipfs) return `https://ipfs.io/ipfs/${ipfs[1]}`
  const ar = /^ar:\/\/(.+)$/i.exec(image)
  if (ar) return `https://arweave.net/${ar[1]}`
  return image
}

/** Enlace del explorer a una transacción. */
export function explorerTxUrl(hash: string, network: string | undefined, base?: string): string {
  return `${explorerAddressBase(network, base)}/tx/${hash}`
}

/** Enlace del explorer a una dirección. */
export function explorerAddressUrl(address: string, network: string | undefined, base?: string): string {
  return `${explorerAddressBase(network, base)}/address/${address}`
}
