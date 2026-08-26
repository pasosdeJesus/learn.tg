// Adapter del core → motor `rewards` (REQ/35 §11.2 D2).
// El host inyecta DB, auth, métricas y las funciones de backend-config;
// las rutas de la app re-exportan handlers del motor sin lógica propia.
import { createRewardsApp } from '@learn-tg/rewards/src/index'
import { newKyselyPostgresql } from '@/.config/kysely-db'
import { authenticateUser } from '@/lib/authenticateUser'
import { recordEvent } from '@/lib/metrics-server'
import {
  getPublicClient,
  getWalletClient,
  getBackendWallet,
  getUsdtAddress,
  getUsdtDecimals,
  getChain,
  sendTxAndWait,
  fetchTxWithReceipt,
  MAX_TX_AGE,
  SLEARN_RATE,
  SLEARN_DECIMALS,
} from '@/lib/backend-config'
import { routeReward } from '@/lib/reward-routing'
import { routeToClusterFunds } from '@/lib/gd-cluster-routing'
import { canPurchasePremiumCourse } from '@/lib/course-access'
import { updateUserAndCoursePoints } from '@/lib/scores'

export const rewardsApp = createRewardsApp({
  db: () => newKyselyPostgresql(),
  authenticateUser,
  recordEvent,
  backend: {
    getPublicClient,
    getWalletClient,
    getBackendWallet,
    getUsdtAddress,
    getUsdtDecimals,
    getChain,
    sendTxAndWait,
    fetchTxWithReceipt,
    MAX_TX_AGE,
    SLEARN_RATE,
    SLEARN_DECIMALS,
  },
  routeReward,
  routeToClusterFunds,
  canPurchasePremiumCourse,
  updateUserAndCoursePoints,
})
