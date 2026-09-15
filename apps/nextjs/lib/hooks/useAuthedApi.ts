'use client'

// Single standard mechanism for authenticated, same-origin API calls
// (R-#227 / R-#233). Every page/hook uses it instead of ad-hoc
// `walletAddress=…&token=…` query building and per-page cold-session
// workarounds.
//
// - Identity comes from the NextAuth session, with the localStorage fallback
//   for the cold-session bug (#5719), both via `useAuthAddress`.
// - `ready` is false while a connected user's address has not resolved yet, so
//   pages wait instead of firing an anonymous request (the cause of the false
//   "cooldown" / 0% cards).
// - Requests are same-origin and authorize through the session cookie; only
//   `walletAddress` (identity hint) is added. The legacy API token remains a
//   server-side fallback for non-browser clients and is never sent by the app.
import { useCallback } from 'react'
import axios, { type AxiosRequestConfig } from 'axios'
import { useSession } from 'next-auth/react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

export function useAuthedApi() {
  const { data: session, status } = useSession()
  const { address, sessionAddress, storedAddress, isWalletAvailable, isWalletCheckComplete } =
    useAuthAddress()

  const sessionAddr = (session as { address?: string } | null)?.address
  const wallet = address || sessionAddress || sessionAddr || storedAddress || null
  // Partial login: the session and the localStorage fallback point to different
  // wallets (e.g. the wallet was switched). Fetching with a mismatched identity
  // would mix state; pages show "Partial login" instead.
  const fallbackAddr = sessionAddress || storedAddress
  const mismatch =
    !!sessionAddr && !!fallbackAddr && sessionAddr.toLowerCase() !== fallbackAddr.toLowerCase()
  const connectedHint =
    status === 'authenticated' || !!sessionAddress || !!address || !!storedAddress
  // While a connected user's address is not resolved yet (or the identities
  // mismatch), pages must wait (ready=false) instead of querying anonymously.
  const ready = !mismatch && (!!wallet || !connectedHint)

  const withWallet = useCallback(
    (base: string) => {
      if (!wallet) return base
      const sep = base.includes('?') ? '&' : '?'
      return `${base}${sep}walletAddress=${encodeURIComponent(wallet)}`
    },
    [wallet],
  )

  const authedGet = useCallback(
    <T = unknown,>(base: string, config?: AxiosRequestConfig) =>
      config
        ? axios.get<T>(withWallet(base), config)
        : axios.get<T>(withWallet(base)),
    [withWallet],
  )

  // Mutations: some routes read the identity from the query (profile,
  // notifications) and others from the body (check-crossword), so the hook adds
  // `walletAddress` to both. No token is ever sent.
  const withBody = useCallback(
    (data?: unknown) =>
      data && typeof data === 'object' && !Array.isArray(data)
        ? { ...(data as Record<string, unknown>), walletAddress: wallet }
        : data,
    [wallet],
  )

  const authedPost = useCallback(
    <T = unknown,>(base: string, data?: unknown, config?: AxiosRequestConfig) =>
      axios.post<T>(withWallet(base), withBody(data), config),
    [withWallet, withBody],
  )

  const authedPatch = useCallback(
    <T = unknown,>(base: string, data?: unknown, config?: AxiosRequestConfig) =>
      axios.patch<T>(withWallet(base), withBody(data), config),
    [withWallet, withBody],
  )

  const authedDelete = useCallback(
    <T = unknown,>(base: string, data?: unknown, config?: AxiosRequestConfig) =>
      axios.delete<T>(withWallet(base), { ...(config || {}), data: withBody(data) }),
    [withWallet, withBody],
  )

  return {
    /** Authenticated wallet address (session ∪ localStorage fallback), or null. */
    wallet,
    /** True once the identity is resolved, or when there is no one connected. */
    ready,
    /** Session address and localStorage fallback point to different wallets. */
    mismatch,
    /** NextAuth session status === 'loading'. */
    loading: status === 'loading',
    isAuthenticated: !!wallet,
    isWalletAvailable,
    isWalletCheckComplete,
    /** Append the identity hint to a URL (same-origin API call). */
    withWallet,
    authedGet,
    authedPost,
    authedPatch,
    authedDelete,
  }
}
