'use client'

import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'

/**
 * RPC endpoint for the chain the app runs on.
 *
 * `NEXT_PUBLIC_RPC_URL` comes from `apps/.env`; the fallback is the public forno
 * endpoint of the chain so a build without that variable still works. It is needed
 * by the in-app wallet provider, which forwards reads (`eth_call`,
 * `eth_getBalance`, `eth_estimateGas`…) and broadcasts to the RPC.
 */
const FALLBACK_RPC = IS_PRODUCTION
  ? 'https://forno.celo.org'
  : 'https://forno.celo-sepolia.celo-testnet.org'

export function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_RPC_URL || FALLBACK_RPC
}
