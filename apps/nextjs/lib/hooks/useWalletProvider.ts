'use client'

import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import type { Eip1193Provider } from '@learn-tg/pdj-wallet'
import { useExternalProvider } from '@/lib/external-provider'

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
 */
export function useWalletProvider(): WalletProviderState {
  const { status, getProvider } = useInAppWallet()
  const isInAppUnlocked = status === 'unlocked'
  const inApp = isInAppUnlocked ? getProvider() : null
  const { provider: external, available: externalAvailable } = useExternalProvider()

  return {
    provider: inApp ?? external,
    isInApp: !!inApp,
    isInAppUnlocked,
    externalAvailable,
  }
}
