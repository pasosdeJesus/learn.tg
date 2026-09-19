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
 * Reads are **public**: they go directly to the chain RPC and do not need a wallet.
 * Before, this client was built on the wallet provider, so it was `null` while the
 * in-app wallet was locked and — once built on it — every read failed with
 * "Unsupported method: eth_call". The donation and purchase modals ended up showing
 * the three balances as zero with the funds in the wallet
 * (`/var/www/adJ-ia/en.txt`, 2026-09-19).
 */
export function usePublicClient() {
  return useMemo(
    () =>
      createPublicClient({
        chain,
        transport: http(getRpcUrl()),
      }),
    [],
  )
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
