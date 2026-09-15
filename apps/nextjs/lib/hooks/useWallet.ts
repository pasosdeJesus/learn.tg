'use client'

import { useMemo } from 'react'
import { createPublicClient, createWalletClient, custom } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useWalletProvider } from '@/lib/hooks/useWalletProvider'

const chain = IS_PRODUCTION ? celo : celoSepolia

/**
 * Replacement for wagmi's usePublicClient.
 * Uses the in-app wallet provider when it is unlocked, otherwise window.ethereum.
 */
export function usePublicClient() {
  const { isWalletAvailable } = useAuthAddress()
  const { provider, isInAppUnlocked } = useWalletProvider()

  return useMemo(() => {
    if (typeof window === 'undefined' || !provider) return null
    if (!isInAppUnlocked && !isWalletAvailable) return null
    return createPublicClient({
      chain,
      transport: custom(provider as never),
    })
  }, [provider, isInAppUnlocked, isWalletAvailable])
}

/**
 * Replacement for wagmi's useWalletClient.
 * Uses the in-app wallet provider when it is unlocked, otherwise window.ethereum.
 * Sets the account from the session so writeContract works.
 */
export function useWalletClient() {
  const { address, isWalletAvailable } = useAuthAddress()
  const { provider, isInAppUnlocked } = useWalletProvider()

  const data = useMemo(() => {
    if (typeof window === 'undefined' || !provider || !address) return null
    if (!isInAppUnlocked && !isWalletAvailable) return null
    return createWalletClient({
      account: address as `0x${string}`,
      chain,
      transport: custom(provider as never),
    })
  }, [address, provider, isInAppUnlocked, isWalletAvailable])

  return { data }
}
