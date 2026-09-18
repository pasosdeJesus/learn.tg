'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { getExternalProvider } from '@/lib/external-provider'

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
  const { status: inAppStatus, lockReason } = useInAppWallet()

  // R-#238: cerrar la billetera a propósito (✕) o borrarla termina la sesión,
  // igual que desconectar una billetera externa. Solo cuenta una transición real:
  // una billetera ya bloqueada al cargar la página conserva la sesión.
  // R-#246: el auto-lock por inactividad también la bloquea, pero NO debe cerrar
  // la sesión (`lockReason: 'idle'`); si no, el usuario quedaría desconectado por
  // dejar el teléfono quieto.
  useEffect(() => {
    if (inAppStatus === 'unlocked') {
      wasInAppUnlocked.current = true
      return
    }
    if (inAppStatus === 'loading' || !wasInAppUnlocked.current) return
    wasInAppUnlocked.current = false
    if (lockReason === 'idle') return
    localStorage.removeItem('learn.tg.sessionAddress')
    signOut({ redirect: true, callbackUrl: '/' })
  }, [inAppStatus, lockReason])

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
    // R-#246: el proveedor se resuelve por EIP-6963 + `window.ethereum`; varios
    // navegadores de billetera no definen `window.ethereum` al cargar.
    const provider = getExternalProvider()
    if (typeof window === 'undefined' || !provider) return

    // R-#227 problema 1: algunas billeteras (móvil/Rabby/OneKey) emiten
    // `accountsChanged([])` o `disconnect` AL CONFIRMAR una transacción
    // (p.ej. donación ERC-20 al vault). Si firmamos desconexión a ciegas la
    // app recarga y se pierde el modal de resultado aunque el backend ya
    // registró la operación. Antes de `signOut` re-verificamos `eth_accounts`
    // tras un breve debounce: si la billetera sigue conectada con cuenta, el
    // evento era transitorio y NO se firma la desconexión.
    const verifyStillDisconnected = async (): Promise<boolean> => {
      try {
        const accounts = await provider.request({ method: 'eth_accounts' })
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

    // EIP-1193 tipa los handlers como `(...args: unknown[]) => void`.
    const onAccountsChanged = (...args: unknown[]) => {
      void handleAccountsChanged((args[0] as string[]) ?? [])
    }
    const onDisconnect = () => {
      void handleDisconnect()
    }

    try {
      provider.on?.('accountsChanged', onAccountsChanged)
      provider.on?.('disconnect', onDisconnect)
    } catch {
      // Some wallets don't support event listeners
    }

    return () => {
      try {
        provider.removeListener?.('accountsChanged', onAccountsChanged)
        provider.removeListener?.('disconnect', onDisconnect)
      } catch {}
    }
  }, [session])

  return null
}
