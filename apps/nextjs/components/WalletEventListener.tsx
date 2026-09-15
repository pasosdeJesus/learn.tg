'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'

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
  const wasInAppUnlocked = useRef(false)
  const { status: inAppStatus } = useInAppWallet()

  // R-#238: locking or deleting the in-app wallet ends the session, exactly
  // like disconnecting an external wallet. Only a real transition counts: a
  // wallet that is already locked when the page loads keeps the session.
  useEffect(() => {
    if (inAppStatus === 'unlocked') {
      wasInAppUnlocked.current = true
      return
    }
    if (inAppStatus === 'loading' || !wasInAppUnlocked.current) return
    wasInAppUnlocked.current = false
    localStorage.removeItem('learn.tg.sessionAddress')
    signOut({ redirect: true, callbackUrl: '/' })
  }, [inAppStatus])

  // Clear auth token when session transitions from authenticated to null.
  // Don't clear on initial mount (session loads async — would wipe token).
  useEffect(() => {
    if (session?.address) {
      wasAuthenticated.current = true
    } else if (wasAuthenticated.current) {
      // Session was valid, now it's gone — user signed out or expired
      localStorage.removeItem('learn.tg.sessionAddress')
      wasAuthenticated.current = false
    }
  }, [session?.address])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    // R-#227 problema 1: algunas billeteras (móvil/Rabby/OneKey) emiten
    // `accountsChanged([])` o `disconnect` AL CONFIRMAR una transacción
    // (p.ej. donación ERC-20 al vault). Si firmamos desconexión a ciegas la
    // app recarga y se pierde el modal de resultado aunque el backend ya
    // registró la operación. Antes de `signOut` re-verificamos `eth_accounts`
    // tras un breve debounce: si la billetera sigue conectada con cuenta, el
    // evento era transitorio y NO se firma la desconexión.
    const verifyStillDisconnected = async (): Promise<boolean> => {
      try {
        const accounts = await window.ethereum!.request({ method: 'eth_accounts' })
        return !Array.isArray(accounts) || accounts.length === 0
      } catch {
        return true // no se puede verificar → tratar como desconexión real
      }
    }
    const debounceMs = 400
    let pending = false

    async function handleAccountsChanged(accounts: string[]) {
      if (!accounts || accounts.length === 0) {
        if (pending) return
        pending = true
        await new Promise((r) => setTimeout(r, debounceMs))
        pending = false
        const stillOut = await verifyStillDisconnected()
        if (!stillOut) {
          console.log('[WalletEventListener] accountsChanged([]) transitorio — sesión conservada')
          return
        }
        // User disconnected from wallet
        localStorage.removeItem('learn.tg.sessionAddress')
        signOut({ redirect: true, callbackUrl: '/' })
      }
    }

    async function handleDisconnect() {
      if (pending) return
      pending = true
      await new Promise((r) => setTimeout(r, debounceMs))
      pending = false
      const stillOut = await verifyStillDisconnected()
      if (!stillOut) {
        console.log('[WalletEventListener] disconnect transitorio — sesión conservada')
        return
      }
      localStorage.removeItem('learn.tg.sessionAddress')
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
