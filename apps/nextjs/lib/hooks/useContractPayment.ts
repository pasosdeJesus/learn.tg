'use client'

// Re-export delgado al motor usdt (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §15.6): useContractPayment vive en
// @pasosdejesus/usdt/hooks/useContractPayment. El motor no depende de
// next-auth: este wrapper del host inyecta getCsrfToken (misma firma pública
// que el original).
//
// El motor encadena las transferencias de un pago (USDT y SLEARN) desde
// usdt@0.1.3 (`lib/send-transfers.ts`): espera el recibo de la anterior antes de
// enviar la siguiente, así la segunda no reutiliza el nonce de la primera todavía
// en el mempool ("replacement transaction underpriced", reporte del operador en
// producción, 2026-09-27). No hace falta duplicar esa lógica en el host.
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

export function useContractPayment(
  options: UseContractPaymentOptions,
): UseContractPaymentReturn {
  return usdtUseContractPayment({ ...options, getCsrfToken })
}
