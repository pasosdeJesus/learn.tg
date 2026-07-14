'use client'

import { useSession } from 'next-auth/react'
import type { Session } from 'next-auth'

interface ExtendedSession extends Session {
  address?: string
}

/**
 * Returns the user's authenticated address.
 *
 * Uses NextAuth session.address as the single source of truth for identity.
 * Falls back to localStorage for persistence across navigation (NextAuth bug #5719).
 *
 * wagmi removed in R-#186 Phase 4 — no useAccount() dependency.
 */
export function useAuthAddress() {
  const { data: session } = useSession() as { data: ExtendedSession | null }

  const sessionAddress = session?.address || undefined
  const address = sessionAddress || (
    typeof window !== 'undefined'
      ? localStorage.getItem('learn.tg.sessionAddress') || undefined
      : undefined
  )

  const isAuthenticated = !!address

  return {
    address,
    sessionAddress,
    isAuthenticated,
  }
}
