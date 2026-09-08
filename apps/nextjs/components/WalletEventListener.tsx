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

  // TEMP-DIAG (R-#227 problema 1): timestamp + estado de donación en vuelo para
  // saber qué evento de wallet recarga la página. Eliminar tras el diagnóstico.
  const diagTs = () => new Date().toISOString()
  const inFlight = () => !!(window as any).__donationInFlight
  const diagLog = (evt: string, detail?: unknown) => {
    console.log(`[WalletEvtDiag:${diagTs()}]`, evt,
      JSON.stringify({
        inFlight: inFlight(),
        sessionAddr: (session as any)?.address?.slice(0, 10) || null,
        lastDiag: (window as any).__donationDiag || null,
        ...(detail ? { detail } : {}),
      }))
  }

  // Clear auth token when session transitions from authenticated to null.
  // Don't clear on initial mount (session loads async — would wipe token).
  useEffect(() => {
    if (session?.address) {
      wasAuthenticated.current = true
    } else if (wasAuthenticated.current) {
      diagLog('session->null')
      // Session was valid, now it's gone — user signed out or expired
      localStorage.removeItem('learn.tg.sessionAddress')
      localStorage.removeItem('learn.tg.authToken')
      wasAuthenticated.current = false
    }
  }, [session?.address])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    function handleAccountsChanged(accounts: string[]) {
      diagLog('accountsChanged', { count: accounts?.length, empty: !accounts || accounts.length === 0 })
      if (!accounts || accounts.length === 0) {
        // User disconnected from wallet
        diagLog('accountsChanged -> signOut(redirect:true)')
        localStorage.removeItem('learn.tg.sessionAddress')
        localStorage.removeItem('learn.tg.authToken')
        signOut({ redirect: true, callbackUrl: '/' })
      }
    }

    function handleDisconnect() {
      diagLog('disconnect -> signOut(redirect:true)')
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
