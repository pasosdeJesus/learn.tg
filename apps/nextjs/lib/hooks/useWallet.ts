'use client'

import { useMemo } from 'react'
import { createPublicClient, createWalletClient, custom } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { IS_PRODUCTION } from '@/lib/config'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

const chain = IS_PRODUCTION ? celo : celoSepolia

/**
 * Replacement for wagmi's usePublicClient.
 * Uses window.ethereum as the transport — no wagmi dependency.
 */
export function usePublicClient() {
  const { isWalletAvailable } = useAuthAddress()

  return useMemo(() => {
    if (typeof window === 'undefined' || !window.ethereum || !isWalletAvailable) return null
    return createPublicClient({
      chain,
      transport: custom(window.ethereum),
    })
  }, [isWalletAvailable])
}

/**
 * Replacement for wagmi's useWalletClient.
 * Uses window.ethereum as the transport — no wagmi dependency.
 * Sets the account from NextAuth session so writeContract works.
 */
export function useWalletClient() {
  const { address, isWalletAvailable } = useAuthAddress()

  const data = useMemo(() => {
    if (typeof window === 'undefined' || !window.ethereum || !isWalletAvailable || !address) return null
    return createWalletClient({
      account: address as `0x${string}`,
      chain,
      transport: custom(window.ethereum),
    })
  }, [address, isWalletAvailable])

  return { data }
}
