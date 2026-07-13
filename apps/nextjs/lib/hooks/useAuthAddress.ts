'use client'

import { useEffect, useRef } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { useSession } from 'next-auth/react'
import { injected } from 'wagmi/connectors'
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
 * Phase 2 (R-#185): auto-reconnects wagmi when session exists but wagmi
 * reports disconnected — attacks the root cause, not just symptoms.
 *
 * Usage:
 *   const { address, isConnected, isWalletConnected, isAuthenticated } = useAuthAddress()
 */
export function useAuthAddress() {
  const { address: wagmiAddress, isConnected } = useAccount()
  const { connectAsync } = useConnect()
  const { data: session } = useSession() as { data: ExtendedSession | null }
  const retryRef = useRef(0)

  const sessionAddress = session?.address || undefined
  const address = wagmiAddress || sessionAddress

  const isWalletConnected = isConnected &&
    !!wagmiAddress &&
    !!sessionAddress &&
    sessionAddress.toLowerCase() === wagmiAddress.toLowerCase()

  const isAuthenticated = !!address

  // Auto-reconnect: when session exists but wagmi lost connection (common
  // after client-side navigation), attempt to silently reconnect up to 3 times.
  useEffect(() => {
    if (!sessionAddress) return
    if (isConnected && wagmiAddress) return
    if (retryRef.current >= 3) return

    const timer = setTimeout(() => {
      retryRef.current++
      connectAsync?.({ connector: injected() }).catch(() => {})
    }, 1000)

    return () => clearTimeout(timer)
  }, [sessionAddress, isConnected, wagmiAddress, connectAsync])

  // Reset retry counter when wagmi successfully connects
  useEffect(() => {
    if (isConnected && wagmiAddress) {
      retryRef.current = 0
    }
  }, [isConnected, wagmiAddress])

  return {
    address,
    wagmiAddress,
    sessionAddress,
    isConnected,
    isWalletConnected,
    isAuthenticated,
  }
}
