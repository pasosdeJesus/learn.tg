'use client'

import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'
import { celo, celoSepolia } from 'viem/chains'

/**
 * Red (chain) en la que corre la app: Celo mainnet en producción y Celo Sepolia en
 * desarrollo. Una sola fuente para los clientes viem (`lib/hooks/useWallet.ts`) y para
 * el pre-flight de red de los flujos de pago (`lib/ensure-chain.ts`).
 */
export function getAppChain() {
  return IS_PRODUCTION ? celo : celoSepolia
}
