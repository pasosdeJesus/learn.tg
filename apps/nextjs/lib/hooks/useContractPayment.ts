'use client'

// Re-export delgado al motor usdt (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §15.6): useContractPayment vive en
// @pasosdejesus/usdt/hooks/useContractPayment. El motor no depende de
// next-auth: este wrapper del host inyecta getCsrfToken (misma firma pública
// que el original).
import { useMemo } from 'react'
import {
  useContractPayment as usdtUseContractPayment,
  type UseContractPaymentOptions,
  type UseContractPaymentReturn,
} from '@pasosdejesus/usdt/hooks/useContractPayment'
import { getCsrfToken } from 'next-auth/react'

export type { PaymentState } from '@pasosdejesus/usdt/hooks/useContractPayment'
export type {
  UseContractPaymentOptions,
  UseContractPaymentReturn,
} from '@pasosdejesus/usdt/hooks/useContractPayment'

/** Espera máxima del recibo de la transferencia anterior (el motor espera igual para confirmar la donación). */
const RECEIPT_TIMEOUT_MS = 120_000

/** Lo mínimo que el motor usa del wallet client. */
interface TransferClient {
  writeContract: (args: Record<string, unknown>) => Promise<`0x${string}`>
}

interface ReceiptClient {
  waitForTransactionReceipt?: (args: { hash: `0x${string}`; timeout?: number }) => Promise<unknown>
}

/**
 * Encadena las transferencias de un mismo pago.
 *
 * Una donación a curso, clúster o país puede llevar **dos** transferencias ERC-20
 * (USDT y SLEARN) y el motor las manda una tras otra. La segunda reutilizaba el
 * nonce de la primera —que seguía en el mempool— y el RPC la rechazaba con
 * "replacement transaction underpriced" (reporte del operador en producción,
 * 2026-09-27; la misma carrera está descrita en
 * `e2e/specs/vault-both-donate.spec.mjs`, que por eso le pasa nonces explícitos).
 *
 * Esperar el recibo de la anterior antes de enviar la siguiente deja que la
 * billetera —externa o in-app— elija un nonce nuevo. La espera es "best effort",
 * igual que la confirmación del motor: si el recibo no llega, se envía igual y el
 * backend verifica cada hash. Dos envíos **simultáneos** (un doble clic) se
 * rechazan en vez de donar dos veces.
 */
export function sequenceTransfers<T extends TransferClient>(
  walletClient: T | null | undefined,
  publicClient: ReceiptClient | null | undefined,
): T | null | undefined {
  if (!walletClient || typeof walletClient.writeContract !== 'function') return walletClient

  let lastHash: `0x${string}` | null = null
  let sending = false

  return new Proxy(walletClient, {
    get(target, property, receiver) {
      if (property !== 'writeContract') return Reflect.get(target, property, receiver)
      return async (args: Record<string, unknown>): Promise<`0x${string}`> => {
        if (sending) {
          throw new Error('A transfer is already being sent. Wait for it to confirm.')
        }
        sending = true
        try {
          if (lastHash) {
            const hash = lastHash
            lastHash = null
            try {
              await publicClient?.waitForTransactionReceipt?.({ hash, timeout: RECEIPT_TIMEOUT_MS })
            } catch {
              // El recibo no llegó (o el RPC falla): se envía igual.
            }
          }
          const hash = await target.writeContract(args)
          lastHash = hash
          return hash
        } finally {
          sending = false
        }
      }
    },
  })
}

export function useContractPayment(
  options: UseContractPaymentOptions,
): UseContractPaymentReturn {
  const { walletClient, publicClient } = options
  // Las transferencias de un pago van en fila para no reutilizar el nonce de la
  // anterior (R-#268).
  const sequentialWalletClient = useMemo(
    () => sequenceTransfers(walletClient, publicClient),
    [walletClient, publicClient],
  )

  return usdtUseContractPayment({
    ...options,
    walletClient: sequentialWalletClient,
    getCsrfToken,
  })
}
