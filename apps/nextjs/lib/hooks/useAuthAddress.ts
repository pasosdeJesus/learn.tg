'use client'

import { useSession } from 'next-auth/react'
import type { Session } from 'next-auth'
import { useState, useEffect } from 'react'
import { logger } from '@pasosdejesus/m/debug'

interface ExtendedSession extends Session {
  address?: string
}

/**
 * Returns the user's authenticated address.
 *
 * Uses NextAuth session.address as the single source of truth for identity.
 * Falls back to localStorage for persistence across navigation (NextAuth bug #5719).
 *
 * Also tracks whether window.ethereum is available — when the wallet is not
 * active in the browser, the address from session/localStorage is stale
 * and should not be used for write operations.
 *
 * wagmi removed in R-#186 Phase 4 — no useAccount() dependency.
 */
export function useAuthAddress() {
  const { data: session } = useSession() as { data: ExtendedSession | null }
  const [isWalletAvailable, setIsWalletAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    logger.info('useAuthAddress: checking wallet availability', 'auth')

    const check = async () => {
      const hasProvider = !!window.ethereum
      if (!hasProvider) {
        logger.info('useAuthAddress: no window.ethereum provider', 'auth')
        setIsWalletAvailable(false)
        return
      }
      // Verify there are actually connected accounts (no prompt)
      try {
        const accounts = await window.ethereum!.request({
          method: 'eth_accounts',
        })
        const available = Array.isArray(accounts) && accounts.length > 0
        logger.info(
          `useAuthAddress: eth_accounts=${JSON.stringify(accounts)} available=${available}`,
          'auth',
        )
        setIsWalletAvailable(available)
      } catch (e) {
        logger.error(`useAuthAddress: eth_accounts error: ${String(e)}`, 'auth')
        setIsWalletAvailable(false)
      }
    }
    check()

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', check)
      window.ethereum.on('connect', check)
      window.ethereum.on('disconnect', () => setIsWalletAvailable(false))
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', check)
        window.ethereum.removeListener('connect', check)
      }
    }
  }, [])

  const sessionAddress = session?.address || undefined
  const storedAddress = typeof window !== 'undefined'
    ? localStorage.getItem('learn.tg.sessionAddress') || undefined
    : undefined

  const address = sessionAddress || storedAddress
  const isAuthenticated = !!address

  const isWalletCheckComplete = isWalletAvailable !== null

  return {
    address,
    sessionAddress,
    storedAddress,
    isAuthenticated,
    isWalletAvailable: !!isWalletAvailable,
    isWalletCheckComplete,
  }
}
