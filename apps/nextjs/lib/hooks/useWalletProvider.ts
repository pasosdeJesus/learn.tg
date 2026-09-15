'use client'

import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import type { Eip1193Provider } from '@learn-tg/pdj-wallet'

export interface WalletProviderState {
  provider: Eip1193Provider | null
  isInApp: boolean
  isInAppUnlocked: boolean
  externalAvailable: boolean
}

/**
 * Effective EIP-1193 provider for the app: the in-app wallet when it is
 * unlocked, otherwise the injected external wallet (window.ethereum).
 */
export function useWalletProvider(): WalletProviderState {
  const { status, getProvider } = useInAppWallet()
  const isInAppUnlocked = status === 'unlocked'
  const inApp = isInAppUnlocked ? getProvider() : null
  const external =
    typeof window !== 'undefined'
      ? ((window as { ethereum?: Eip1193Provider }).ethereum ?? null)
      : null

  return {
    provider: inApp ?? external,
    isInApp: !!inApp,
    isInAppUnlocked,
    externalAvailable: !!external,
  }
}
