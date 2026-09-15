'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
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

interface InAppWalletState {
  status: InAppWalletStatus
  walletInfo: WalletInfo | null
  error: string | null
}

const initialState: InAppWalletState = { status: 'loading', walletInfo: null, error: null }

// Estado compartido por todas las instancias del hook. Sin esto, cada componente
// que llama a `useInAppWallet()` tiene su propia copia: `InAppWalletSetup`
// desbloquea la billetera y el consumidor (p. ej. `WalletSelector`) sigue viendo
// `locked`, de modo que la interfaz parece no hacer nada.
let state: InAppWalletState = initialState
let initialized = false
const listeners = new Set<() => void>()

function setState(partial: Partial<InAppWalletState>): void {
  state = { ...state, ...partial }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): InAppWalletState {
  return state
}

function getServerSnapshot(): InAppWalletState {
  return initialState
}

/** Reads the stored wallet once per page load, whoever asks first. */
async function initialize(): Promise<void> {
  if (initialized) return
  initialized = true

  if (typeof window === 'undefined' || !window.indexedDB) {
    setState({ status: 'no-wallet', walletInfo: null })
    return
  }
  try {
    const exists = await hasWallet()
    if (!exists) {
      setState({ status: 'no-wallet', walletInfo: null })
      return
    }
    const info = await getWalletInfo()
    setState({
      walletInfo: info,
      status: state.status === 'unlocked' ? 'unlocked' : 'locked',
    })
  } catch {
    setState({ status: 'no-wallet', walletInfo: null })
  }
}

/** Test-only: forgets the shared state and the "already initialized" flag. */
export function resetInAppWalletStoreForTests(): void {
  state = initialState
  initialized = false
  for (const listener of listeners) listener()
}

export function useInAppWallet(): UseInAppWalletResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    void initialize()
  }, [])

  const create = useCallback(async (pin: string) => {
    setState({ error: null })
    try {
      const result = await createWallet({ pin })
      setState({ walletInfo: result.walletInfo, status: 'unlocked' })
      return result
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  }, [])

  const importExisting = useCallback(async (options: ImportWalletOptions) => {
    setState({ error: null })
    try {
      const info = await importWallet(options)
      setState({ walletInfo: info, status: 'unlocked' })
      return info
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  }, [])

  const unlock = useCallback(async (pin: string) => {
    setState({ error: null })
    try {
      const info = await unlockWallet(pin)
      setState({ walletInfo: info, status: 'unlocked' })
      return info
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  }, [])

  const lock = useCallback(async () => {
    await lockWallet()
    setState({ status: 'locked' })
  }, [])

  const remove = useCallback(async () => {
    await deleteWallet()
    setState({ walletInfo: null, status: 'no-wallet' })
  }, [])

  const getProvider = useCallback(() => getInAppWalletProvider(), [])

  return {
    status: snapshot.status,
    walletInfo: snapshot.walletInfo,
    error: snapshot.error,
    create,
    importExisting,
    unlock,
    lock,
    remove,
    getProvider,
  }
}
