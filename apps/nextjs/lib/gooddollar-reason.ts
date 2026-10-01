/**
 * Por qué el botón de GoodDollar puede o no puede reclamar/verificar
 * (https://github.com/pasosdeJesus/learn.tg/issues/271).
 *
 * Antes, cuando el SDK no quedaba listo el botón culpaba a la red ("Not available
 * on testnet") aunque el motivo real fuera otro: la billetera in-app **bloqueada**
 * no expone su proveedor, y sin proveedor no hay `walletClient` ni SDK. El
 * operador lo vio en mainnet (2026-10-01).
 *
 * Este módulo es la única fuente de esa decisión, separada de la UI para poder
 * probarla.
 */

/**
 * Redes donde GoodDollar tiene UBI, según `SUPPORTED_CHAIN_IDS` del propio
 * `@goodsdks/citizen-sdk` (v1.2.7): Fuse (50), XDC (122) y Celo (42220). La misma
 * lista usa el GoodWallet oficial. **Celo Sepolia (11142220) no está**: en esa red
 * GoodDollar realmente no opera y el camino es learn.tg-UBI (CELO).
 */
export const GOODDOLLAR_SUPPORTED_CHAIN_IDS = [50, 122, 42220]

export type GoodDollarReason =
  | 'ready'
  | 'no-wallet'
  | 'locked'
  | 'provider-unsupported'
  | 'network-unsupported'
  | 'sdk-error'

export interface GoodDollarReasonInput {
  /** Sesión SIWE con dirección. */
  hasAddress: boolean
  /** Hay un firmante disponible (billetera desbloqueada o externa conectada). */
  hasWalletClient: boolean
  /** Estado de la billetera in-app. */
  inAppStatus?: 'loading' | 'no-wallet' | 'locked' | 'unlocked' | null
  /** El SDK de identidad se pudo construir. */
  hasIdentitySDK: boolean
  /** Construir el SDK lanzó. */
  sdkError?: unknown
  /** Red de la app (`getAppChain().id`). */
  chainId?: number | null
}

export function resolveGoodDollarReason(input: GoodDollarReasonInput): GoodDollarReason {
  if (!input.hasAddress) return 'no-wallet'
  if (input.inAppStatus === 'locked') return 'locked'
  if (input.sdkError) return 'sdk-error'
  if (!input.hasWalletClient || !input.hasIdentitySDK) return 'provider-unsupported'
  if (input.chainId != null && !GOODDOLLAR_SUPPORTED_CHAIN_IDS.includes(input.chainId)) {
    return 'network-unsupported'
  }
  return 'ready'
}

export function isGoodDollarReady(reason: GoodDollarReason): boolean {
  return reason === 'ready'
}
