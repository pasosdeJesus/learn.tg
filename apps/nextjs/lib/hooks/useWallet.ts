'use client'

import { useMemo } from 'react'
import { createPublicClient, createWalletClient, custom } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { IS_PRODUCTION } from '@/lib/config'

const chain = IS_PRODUCTION ? celo : celoSepolia

/**
 * Replacement for wagmi's usePublicClient.
 * Uses window.ethereum as the transport — no wagmi dependency.
 */
export function usePublicClient() {
  return useMemo(() => {
    if (typeof window === 'undefined' || !window.ethereum) return null
    return createPublicClient({
      chain,
      transport: custom(window.ethereum),
    })
  }, [])
}

/**
 * Replacement for wagmi's useWalletClient.
 * Uses window.ethereum as the transport — no wagmi dependency.
 */
export function useWalletClient() {
  const { data } = useMemo(() => {
    if (typeof window === 'undefined' || !window.ethereum) return { data: null }
    const client = createWalletClient({
      chain,
      transport: custom(window.ethereum),
    })
    return { data: client }
  }, [])
  return { data }
}
