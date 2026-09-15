'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  createWallet,
  deleteWallet,
  getInAppWalletProvider,
  getWalletInfo,
  hasWallet,
  importWallet,
  lockWallet,
  unlockWallet,
  type Eip1193Provider,
  type ImportWalletOptions,
  type WalletInfo,
} from '@learn-tg/pdj-wallet'

export type InAppWalletStatus = 'loading' | 'no-wallet' | 'locked' | 'unlocked'

export interface UseInAppWalletResult {
  status: InAppWalletStatus
  walletInfo: WalletInfo | null
  error: string | null
  create: (pin: string) => Promise<{ walletInfo: WalletInfo; mnemonic: string }>
  importExisting: (options: ImportWalletOptions) => Promise<WalletInfo>
  unlock: (pin: string) => Promise<WalletInfo>
  lock: () => Promise<void>
  remove: () => Promise<void>
  getProvider: () => Eip1193Provider | null
}

export function useInAppWallet(): UseInAppWalletResult {
  const [status, setStatus] = useState<InAppWalletStatus>('loading')
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        if (!cancelled) setStatus('no-wallet')
        return
      }
      try {
        const exists = await hasWallet()
        if (cancelled) return
        if (!exists) {
          setStatus('no-wallet')
          return
        }
        const info = await getWalletInfo()
        if (cancelled) return
        setWalletInfo(info)
        setStatus('locked')
      } catch {
        if (!cancelled) setStatus('no-wallet')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const create = useCallback(async (pin: string) => {
    setError(null)
    try {
      const result = await createWallet({ pin })
      setWalletInfo(result.walletInfo)
      setStatus('unlocked')
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      throw e
    }
  }, [])

  const importExisting = useCallback(async (options: ImportWalletOptions) => {
    setError(null)
    try {
      const info = await importWallet(options)
      setWalletInfo(info)
      setStatus('unlocked')
      return info
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      throw e
    }
  }, [])

  const unlock = useCallback(async (pin: string) => {
    setError(null)
    try {
      const info = await unlockWallet(pin)
      setWalletInfo(info)
      setStatus('unlocked')
      return info
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      throw e
    }
  }, [])

  const lock = useCallback(async () => {
    await lockWallet()
    setStatus('locked')
  }, [])

  const remove = useCallback(async () => {
    await deleteWallet()
    setWalletInfo(null)
    setStatus('no-wallet')
  }, [])

  const getProvider = useCallback(() => getInAppWalletProvider(), [])

  return { status, walletInfo, error, create, importExisting, unlock, lock, remove, getProvider }
}
