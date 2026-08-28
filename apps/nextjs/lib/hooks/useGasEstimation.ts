'use client'

// Re-export delgado al motor usdt (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §15.6): useGasEstimation vive en
// @pasosdejesus/usdt/hooks/useGasEstimation (firma idéntica, sin next-auth).
export {
  useGasEstimation,
  type GasState,
  type UseGasEstimationOptions,
} from '@pasosdejesus/usdt/hooks/useGasEstimation'
