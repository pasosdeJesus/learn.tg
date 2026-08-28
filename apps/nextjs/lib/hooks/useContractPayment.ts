'use client'

// Re-export delgado al motor usdt (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §15.6): useContractPayment vive en
// @pasosdejesus/usdt/hooks/useContractPayment. El motor no depende de
// next-auth: este wrapper del host inyecta getCsrfToken (misma firma pública
// que el original).
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
