'use client'

import { useSession } from 'next-auth/react'
import type { Session } from 'next-auth'
import { useState, useEffect } from 'react'
import { logger } from '@pasosdejesus/m/debug'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { useExternalProvider } from '@/lib/external-provider'

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
  const { data: session, status: sessionStatus } = useSession() as {
    data: ExtendedSession | null
    status: string
  }
  const [isWalletAvailable, setIsWalletAvailable] = useState<boolean | null>(null)
  // R-#246: la billetera inyectada se resuelve por EIP-6963 + `window.ethereum`,
  // porque varios navegadores de billetera no definen `window.ethereum` al cargar.
  const { provider: externalProvider } = useExternalProvider()

  useEffect(() => {
    if (typeof window === 'undefined') return
    logger.info('useAuthAddress: checking wallet availability', 'auth')

    if (!externalProvider) {
      logger.info('useAuthAddress: no external provider', 'auth')
      setIsWalletAvailable(false)
      return
    }

    const check = async () => {
      // Verify there are actually connected accounts (no prompt)
      try {
        const accounts = await externalProvider.request({
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
    void check()

    externalProvider.on?.('accountsChanged', check)
    externalProvider.on?.('connect', check)
    externalProvider.on?.('disconnect', () => setIsWalletAvailable(false))

    return () => {
      externalProvider.removeListener?.('accountsChanged', check)
      externalProvider.removeListener?.('connect', check)
    }
  }, [externalProvider])

  const [mounted, setMounted] = useState(false)
  // R-#218: NO leer localStorage durante el primer render (hidratación). El
  // servidor no tiene localStorage → si el cliente lo lee síncrono, los
  // componentes que alternan DOM según isAuthenticated (p. ej.
  // NotificationsBell: null ↔ div.relative) rompen la hidratación. Se expone
  // tras montar (effect), igual que el patrón de Header/ConnectWalletButton.
  useEffect(() => { setMounted(true) }, [])

  const sessionAddress = session?.address || undefined
  const storedAddress = (typeof window !== 'undefined' && mounted)
    ? localStorage.getItem('learn.tg.sessionAddress') || undefined
    : undefined
  const { status: inAppStatus, walletInfo: inAppWalletInfo } = useInAppWallet()
  const isInAppUnlocked = inAppStatus === 'unlocked'
  const inAppAddress = isInAppUnlocked && inAppWalletInfo?.address
    ? (inAppWalletInfo.address.toLowerCase() as `0x${string}`)
    : undefined

  const address = sessionAddress || inAppAddress || storedAddress
  const isAuthenticated = !!address
  // Mientras NextAuth resuelve la cookie no se sabe si hay sesión: la cabecera
  // debe mostrar un estado neutro, no "desbloquea tu billetera" (reportado el
  // 2026-09-15: tras el SIWE parecía que la sesión se perdía).
  const isSessionLoading = sessionStatus === 'loading'

  const isWalletCheckComplete = isWalletAvailable !== null

  return {
    address,
    sessionAddress,
    storedAddress,
    inAppAddress,
    isInAppUnlocked,
    isAuthenticated,
    isSessionLoading,
    isWalletAvailable: isInAppUnlocked || !!isWalletAvailable,
    isWalletCheckComplete,
  }
}
