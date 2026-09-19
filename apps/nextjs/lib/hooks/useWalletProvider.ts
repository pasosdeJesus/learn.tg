'use client'

import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import type { Eip1193Provider } from '@learn-tg/pdj-wallet'
import { useMemo } from 'react'
import { useExternalProvider } from '@/lib/external-provider'
import { getRpcUrl } from '@/lib/rpc-url'

export interface WalletProviderState {
  provider: Eip1193Provider | null
  isInApp: boolean
  isInAppUnlocked: boolean
  externalAvailable: boolean
}

/**
 * Effective EIP-1193 provider for the app: the in-app wallet when it is
 * unlocked, otherwise the injected external wallet.
 *
 * The external wallet is resolved through `lib/external-provider.ts`, which also
 * listens for EIP-6963 announcements: several wallet browsers (Rabby, MetaMask,
 * OneKey mobile) do not define `window.ethereum` at page load, and depending on
 * that timing hid the external option (R-#246 §8).
 *
 * The in-app provider carries the RPC URL (reads and broadcasts are forwarded to
 * it) and is memoized: a fresh object on every render recreated the viem clients
 * on top of it and looped the modals' effects.
 */
export function useWalletProvider(): WalletProviderState {
  const { status, getProvider } = useInAppWallet()
  const isInAppUnlocked = status === 'unlocked'
  const inApp = useMemo(
    () => (isInAppUnlocked ? getProvider(getRpcUrl()) : null),
    [isInAppUnlocked, getProvider],
  )
  const { provider: external, available: externalAvailable } = useExternalProvider()

  return {
    provider: inApp ?? external,
    isInApp: !!inApp,
    isInAppUnlocked,
    externalAvailable,
  }
}
