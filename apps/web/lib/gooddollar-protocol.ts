/**
 * El protocolo de UBI de GoodDollar, en un solo lugar
 * (https://github.com/pasosdeJesus/learn.tg/issues/271 §10.4).
 *
 * No usamos `@goodsdks/citizen-sdk` para reclamar: el SDK agrega su propia política
 * de frescura de verificación que puede bloquear a una dirección ya whitelisteada
 * (medido 2026-10-01), y nos haría depender de sus servicios. Hacemos lo que hace la
 * billetera oficial GoodWallet: leer `IdentityV2` / `UBIScheme` y reclamar directo.
 *
 * Todo lo que puede cambiar del protocolo vive aquí y `detectProtocolChange()` lo
 * vigila: direcciones, selectores, decimales, cadenas soportadas y el texto que se
 * firma para la verificación facial. `lib/__tests__/gooddollar-protocol.test.ts`
 * contrasta estos valores con los del SDK oficial instalado, así que un redeploy o
 * un cambio de mensaje **falla una prueba** en vez de romper en silencio.
 */

import { parseAbi } from 'viem'

/** Única cadena donde GoodDollar tiene UBI para learn.tg. */
export const GOODDOLLAR_CHAIN_ID = 42220

/** Cadenas soportadas por el protocolo (las mismas del SDK: Fuse, XDC, Celo). */
export const GOODDOLLAR_SUPPORTED_CHAIN_IDS = [50, 122, 42220] as const

/** Direcciones de producción en Celo (`chainConfigs[42220].contracts.production`). */
export const GOODDOLLAR_ADDRESSES = {
  identity: '0xC361A6E67822a0EDc17D899227dd9FC50BD62F42',
  ubi: '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1',
  gDollar: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
} as const

/** Servicios de GoodDollar (los mismos del SDK/GoodWallet). */
export const GOODDOLLAR_SERVICES = {
  goodId: 'https://goodid.gooddollar.org',
  backend: 'https://goodserver.gooddollar.org',
} as const

/** Selectores esperados (keccak del signature). `claim()` está confirmado en una tx real. */
export const GOODDOLLAR_SELECTORS = {
  claim: '0x4e71d92d',
  getWhitelistedRoot: '0x2d0e9b46',
  checkEntitlement: '0x1a787f2e',
  getWhitelistedOnChainId: '0xa061922d',
  paused: '0x5c975abb',
} as const

/** Decimales de G$ en Celo (18; en Fuse son 2). */
export const GOODDOLLAR_G_DECIMALS = 18

/** Texto **exacto** que la billetera firma para pedir la verificación facial. */
export const GOODDOLLAR_FV_MESSAGE =
  'Sign this message to request verifying your account <account> and to create your own secret unique identifier for your anonymized record.\nYou can use this identifier in the future to delete this anonymized record.\nWARNING: do not sign this message unless you trust the website/application requesting this signature.'

export function goodDollarFvMessage(account: string): string {
  return GOODDOLLAR_FV_MESSAGE.replace('<account>', account)
}

export const GOODDOLLAR_IDENTITY_ABI = parseAbi([
  'function getWhitelistedRoot(address) view returns (address)',
  'function getWhitelistedOnChainId(address) view returns (uint256)',
])

export const GOODDOLLAR_UBI_ABI = parseAbi([
  'function checkEntitlement(address) view returns (uint256)',
  'function paused() view returns (bool)',
  'function claim()',
])

/** Para vigilar los decimales de G$ (`detectProtocolChange`). */
export const GOODDOLLAR_ERC20_ABI = parseAbi(['function decimals() view returns (uint8)'])

/**
 * Firma estable del protocolo: si cambia cualquiera de los valores vigilados, esta
 * cadena cambia. Sirve para registrarla en logs/eventos y notar el cambio.
 */
export function goodDollarProtocolSignature(): string {
  return [
    `chain:${GOODDOLLAR_CHAIN_ID}`,
    `identity:${GOODDOLLAR_ADDRESSES.identity}`,
    `ubi:${GOODDOLLAR_ADDRESSES.ubi}`,
    `g$:${GOODDOLLAR_ADDRESSES.gDollar}`,
    `claim:${GOODDOLLAR_SELECTORS.claim}`,
    `entitlement:${GOODDOLLAR_SELECTORS.checkEntitlement}`,
    `decimals:${GOODDOLLAR_G_DECIMALS}`,
  ].join('|')
}

export interface ProtocolFacts {
  chainId: number
  identityHasCode: boolean
  ubiHasCode: boolean
  /** `UBIScheme.paused()` leído on-chain (null si no se pudo). */
  ubiPaused?: boolean | null
  /** Decimales reales de G$ (null si no se pudieron leer). */
  gDecimals?: number | null
}

/**
 * Devuelve la lista de señales de que el protocolo cambió (vacía = todo en orden).
 * Quien reclama la usa para reportar "el protocolo cambió" en vez de un error opaco.
 */
export function detectProtocolChange(facts: ProtocolFacts): string[] {
  const changes: string[] = []
  if (!(GOODDOLLAR_SUPPORTED_CHAIN_IDS as readonly number[]).includes(facts.chainId)) {
    changes.push(`la cadena ${facts.chainId} no está entre las soportadas (${GOODDOLLAR_SUPPORTED_CHAIN_IDS.join(', ')})`)
  }
  if (!facts.identityHasCode) changes.push(`no hay contrato en IdentityV2 ${GOODDOLLAR_ADDRESSES.identity}`)
  if (!facts.ubiHasCode) changes.push(`no hay contrato en UBIScheme ${GOODDOLLAR_ADDRESSES.ubi}`)
  if (facts.ubiPaused === true) changes.push('UBIScheme está pausado')
  if (facts.gDecimals != null && facts.gDecimals !== GOODDOLLAR_G_DECIMALS) {
    changes.push(`G$ cambió de decimales: ${GOODDOLLAR_G_DECIMALS} → ${facts.gDecimals}`)
  }
  return changes
}

export type GoodDollarAction = 'direct-claim' | 'verify' | 'nothing-today' | 'unsupported-chain'

/**
 * Qué hacer con lo que ya sabemos: si la dirección está whitelisteada y hay beca,
 * se reclama **directo** (sin abrir GoodID); si no está whitelisteada, toca
 * verificar; si ya reclamó hoy, no hay nada que hacer.
 */
export function resolveGoodDollarAction(input: {
  chainId: number
  whitelisted: boolean
  entitlement: bigint
}): GoodDollarAction {
  if (!(GOODDOLLAR_SUPPORTED_CHAIN_IDS as readonly number[]).includes(input.chainId)) return 'unsupported-chain'
  if (!input.whitelisted) return 'verify'
  if (input.entitlement <= 0n) return 'nothing-today'
  return 'direct-claim'
}

/** Enlace de verificación facial, igual que GoodWallet (`isDelta=true`). */
export function buildGoodIdVerificationUrl(input: {
  account: string
  chainId: number
  fvsig: string
  firstname: string
  returnUrl: string
}): string {
  const url = new URL(GOODDOLLAR_SERVICES.goodId)
  url.searchParams.set('account', input.account)
  url.searchParams.set('chain', String(input.chainId))
  url.searchParams.set('fvsig', input.fvsig)
  url.searchParams.set('firstname', input.firstname)
  url.searchParams.set('rdu', input.returnUrl)
  url.searchParams.set('isDelta', 'true')
  return url.toString()
}

/** Lee el regreso de GoodID (`verified=true|reason`). */
export function parseGoodIdReturn(url: string): { verified: boolean; reason: string | null; chainId: number | null } {
  const params = new URL(url).searchParams
  const chainRaw = params.get('chain')
  return {
    verified: params.get('verified') === 'true',
    reason: params.get('reason'),
    chainId: chainRaw ? Number(chainRaw) : null,
  }
}
