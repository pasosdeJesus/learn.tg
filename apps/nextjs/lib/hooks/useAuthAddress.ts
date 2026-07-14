'use client'

import { useAccount } from 'wagmi'
import { useSession } from 'next-auth/react'
import type { Session } from 'next-auth'

interface ExtendedSession extends Session {
  address?: string
}

/**
 * Returns the user's authenticated address.
 *
 * Prefers wagmi's useAccount().address (live wallet connection) and falls back
 * to NextAuth session.address (persists across navigation, survives the known
 * NextAuth bug #5719 where wagmi loses connection on client-side navigation).
 *
 * Usage:
 *   const { address, isConnected, isWalletConnected, isAuthenticated } = useAuthAddress()
 */
export function useAuthAddress() {
  const { address: wagmiAddress, isConnected } = useAccount()
  const { data: session } = useSession() as { data: ExtendedSession | null }

  const sessionAddress = session?.address || undefined
  const address = wagmiAddress || sessionAddress

  const isWalletConnected = isConnected &&
    !!wagmiAddress &&
    !!sessionAddress &&
    sessionAddress.toLowerCase() === wagmiAddress.toLowerCase()

  const isAuthenticated = !!address

  return {
    address,
    wagmiAddress,
    sessionAddress,
    isConnected,
    isWalletConnected,
    isAuthenticated,
  }
}
