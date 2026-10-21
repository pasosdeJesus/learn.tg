'use client'

/**
 * Pre-flight de red antes de firmar o enviar una transacción.
 *
 * viem lanza `ChainMismatchError` — *"The current chain of the wallet (id: X) does not
 * match the target chain for the transaction (id: Y)"* — cuando el cliente se creó con
 * `chain` (la red de la app, `lib/hooks/useWallet.ts`) y la billetera está en otra. Ese
 * texto no le dice nada útil al estudiante: reporte del operador del 2026-09-27 al pagar
 * el curso GD en **producción** con una billetera en Celo Sepolia (11142220).
 *
 * Dos casos distintos:
 * - **Billetera externa** (MetaMask/OKX/Rabby…): se le pide el cambio de red y, si no la
 *   conoce, se agrega primero.
 * - **Billetera in-app**: la misma llave sirve en Celo y en Celo Sepolia, así que su
 *   `wallet_switchEthereumChain` cambia la red declarada (`setWalletChain`, reporte del
 *   operador del 2026-09-27: una billetera creada en el sitio de desarrollo tiene que
 *   poder pagar en producción). Sólo se llega a `WrongChainError` si el cambio no se pudo
 *   aplicar; entonces se dice con claridad en vez de dejar caer el error de viem.
 */

export class WrongChainError extends Error {
  code = 'wrong-chain'
  constructor(
    readonly currentChainId: number | null,
    readonly targetChainId: number,
    readonly isInApp: boolean,
  ) {
    super(
      `Wallet is on chain ${currentChainId ?? 'desconocida'} and the app needs ${targetChainId}`,
    )
    this.name = 'WrongChainError'
  }
}

interface ChainLike {
  id: number
}

interface WalletClientLike {
  getChainId?: () => Promise<number | string>
  switchChain?: (args: { id: number }) => Promise<unknown>
  addChain?: (args: { chain: unknown }) => Promise<unknown>
}

function isInAppProvider(provider: unknown): boolean {
  return !!(provider as { isPdJWallet?: boolean } | null | undefined)?.isPdJWallet
}

/**
 * Deja la billetera en `targetChain` o lanza `WrongChainError`. Si la billetera no expone
 * métodos de red (algunas inyectadas), no se bloquea el pago: la transacción la rechazará
 * el propio proveedor si la red no corresponde.
 */
export async function ensureWalletChain(
  walletClient: WalletClientLike | null | undefined,
  targetChain: ChainLike,
  provider?: unknown,
): Promise<void> {
  if (!walletClient?.getChainId) return

  let current: number | null = null
  try {
    current = Number(await walletClient.getChainId())
  } catch {
    // La billetera no responde `eth_chainId`: se sigue y decide el proveedor.
    return
  }
  if (!Number.isFinite(current) || current === targetChain.id) return

  // Cambio de red (billeteras externas); si no la conoce, se agrega y se reintenta.
  try {
    await walletClient.switchChain?.({ id: targetChain.id })
    return
  } catch {
    /* sigue */
  }
  try {
    await walletClient.addChain?.({ chain: targetChain })
    await walletClient.switchChain?.({ id: targetChain.id })
    return
  } catch {
    /* sigue */
  }

  throw new WrongChainError(current, targetChain.id, isInAppProvider(provider))
}
