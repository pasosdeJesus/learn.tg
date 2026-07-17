'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'

/**
 * Listens for wallet events (disconnect, account change) and syncs
 * the app state. When the user disconnects from their wallet app
 * (OneKey, MetaMask), we clear localStorage and sign out.
 *
 * Mount at the layout level so it runs on every page.
 */
export function WalletEventListener() {
  const { data: session } = useSession()
  const wasAuthenticated = useRef(false)

  // Clear auth token when session transitions from authenticated to null.
  // Don't clear on initial mount (session loads async — would wipe token).
  useEffect(() => {
    if (session?.address) {
      wasAuthenticated.current = true
    } else if (wasAuthenticated.current) {
      // Session was valid, now it's gone — user signed out or expired
      localStorage.removeItem('learn.tg.sessionAddress')
      localStorage.removeItem('learn.tg.authToken')
      wasAuthenticated.current = false
    }
  }, [session?.address])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    function handleAccountsChanged(accounts: string[]) {
      if (!accounts || accounts.length === 0) {
        // User disconnected from wallet
        localStorage.removeItem('learn.tg.sessionAddress')
        localStorage.removeItem('learn.tg.authToken')
        signOut({ redirect: true, callbackUrl: '/' })
      }
    }

    function handleDisconnect() {
      localStorage.removeItem('learn.tg.sessionAddress')
      localStorage.removeItem('learn.tg.authToken')
      signOut({ redirect: true, callbackUrl: '/' })
    }

    try {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('disconnect', handleDisconnect)
    } catch {
      // Some wallets don't support event listeners
    }

    return () => {
      try {
        window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
        window.ethereum?.removeListener?.('disconnect', handleDisconnect)
      } catch {}
    }
  }, [session])

  return null
}
