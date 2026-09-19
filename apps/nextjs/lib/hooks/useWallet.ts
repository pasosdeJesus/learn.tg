'use client'

import { useMemo } from 'react'
import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useWalletProvider } from '@/lib/hooks/useWalletProvider'
import { getRpcUrl } from '@/lib/rpc-url'

const chain = IS_PRODUCTION ? celo : celoSepolia

/**
 * Replacement for wagmi's usePublicClient.
 *
 * Reads go through the available provider when there is one (a real wallet proxies
 * them, and the E2E specs patch `eth_getBalance`/`eth_call` there to simulate
 * balances and gas), and **straight to the RPC when there is none**. That second
 * case was the bug of 2026-09-19: with the in-app wallet locked and no injected
 * wallet this client was `null`, so the donation and purchase modals could not read
 * anything and showed the three balances as zero with the funds in the wallet.
 */
export function usePublicClient() {
  const { provider } = useWalletProvider()

  return useMemo(() => {
    const transport = provider ? custom(provider as never) : http(getRpcUrl())
    return createPublicClient({
      chain,
      transport,
    })
  }, [provider])
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
