'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  createWallet,
  deleteWallet,
  detectPlatformSupport,
  disableBiometricUnlock,
  enableBiometricUnlock,
  getInAppWalletProvider,
  getWalletInfo,
  hasBiometricUnlock,
  hasWallet,
  importWallet,
  lockWallet,
  unlockWallet,
  unlockWithBiometric as unlockWithBiometricCore,
  type Eip1193Provider,
  type ImportWalletOptions,
  type WalletInfo,
} from '@learn-tg/pdj-wallet'

export type InAppWalletStatus = 'loading' | 'no-wallet' | 'locked' | 'unlocked'

/**
 * Why the wallet is locked. `user` is the header ✕ (which signs out), `idle` is
 * the inactivity auto-lock (which must NOT sign the user out).
 */
export type InAppWalletLockReason = 'initial' | 'user' | 'idle' | 'deleted'

/**
 * Auto-lock after this much inactivity, like OneKey and OKX Web3 (R-#246).
 * Dropping the key means the next action asks for the gesture (or the PIN on
 * devices without WebAuthn).
 */
export const INACTIVITY_LOCK_MS = 10 * 60 * 1000

export interface UseInAppWalletResult {
  status: InAppWalletStatus
  walletInfo: WalletInfo | null
  error: string | null
  /** The device can verify the user (Face ID / fingerprint): layers L1/L2 of R-#246. */
  biometricAvailable: boolean
  /** A key sealed with the PRF secret is stored: one gesture unlocks it. */
  biometricEnabled: boolean
  /** Why the wallet got locked: the ✕ (`user`) signs out, `idle` does not. */
  lockReason: InAppWalletLockReason
  create: (pin: string) => Promise<{ walletInfo: WalletInfo; mnemonic: string }>
  importExisting: (options: ImportWalletOptions) => Promise<WalletInfo>
  unlock: (pin: string) => Promise<WalletInfo>
  /** Unlocks with one user-verified WebAuthn gesture (needs `biometricEnabled`). */
  unlockWithBiometric: () => Promise<WalletInfo>
  /** Registers a passkey and seals the key with its PRF secret. Needs the PIN. */
  enableBiometric: (pin: string) => Promise<void>
  disableBiometric: () => Promise<void>
  lock: () => Promise<void>
  remove: () => Promise<void>
  getProvider: () => Eip1193Provider | null
}

interface InAppWalletState {
  status: InAppWalletStatus
  walletInfo: WalletInfo | null
  error: string | null
  biometricAvailable: boolean
  biometricEnabled: boolean
  lockReason: InAppWalletLockReason
}

const initialState: InAppWalletState = {
  status: 'loading',
  walletInfo: null,
  error: null,
  biometricAvailable: false,
  biometricEnabled: false,
  lockReason: 'initial',
}

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

    // R-#246: the unlock lives in module memory. A reload locks the wallet again,
    // which is why the biometric path exists: one gesture instead of the PIN.
    let biometricEnabled = false
    try {
      biometricEnabled = await hasBiometricUnlock()
    } catch {
      biometricEnabled = false
    }

    let biometricAvailable = false
    if (biometricEnabled) {
      biometricAvailable = true
    } else {
      try {
        const support = await detectPlatformSupport()
        // `prf: null` means "the engine did not say": we only know for sure after
        // creating a credential, so treat it as possibly available.
        biometricAvailable = support.userVerifying && support.prf !== false
      } catch {
        biometricAvailable = false
      }
    }

    setState({
      walletInfo: info,
      status: state.status === 'unlocked' ? 'unlocked' : 'locked',
      biometricEnabled,
      biometricAvailable,
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

  const unlockWithBiometric = useCallback(async () => {
    setState({ error: null })
    try {
      const info = await unlockWithBiometricCore()
      setState({ walletInfo: info, status: 'unlocked' })
      return info
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  }, [])

  const enableBiometric = useCallback(async (pin: string) => {
    setState({ error: null })
    try {
      await enableBiometricUnlock(pin)
      setState({ biometricEnabled: true, biometricAvailable: true })
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  }, [])

  const disableBiometric = useCallback(async () => {
    setState({ error: null })
    try {
      await disableBiometricUnlock()
      setState({ biometricEnabled: false })
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  }, [])

  const lock = useCallback(async () => {
    await lockWallet()
    setState({ status: 'locked', lockReason: 'user' })
  }, [])

  const remove = useCallback(async () => {
    await deleteWallet()
    setState({ walletInfo: null, status: 'no-wallet', biometricEnabled: false, lockReason: 'deleted' })
  }, [])

  // R-#246: auto-lock tras inactividad (como OneKey y OKX). Suelta la clave en
  // memoria; NO cierra la sesión (el motivo lo distingue `WalletEventListener`).
  useEffect(() => {
    if (snapshot.status !== 'unlocked') return
    const lockForIdle = () => {
      void lockWallet()
      setState({ status: 'locked', lockReason: 'idle' })
    }
    let timer = window.setTimeout(lockForIdle, INACTIVITY_LOCK_MS)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(lockForIdle, INACTIVITY_LOCK_MS)
    }
    const events = ['pointerdown', 'keydown', 'visibilitychange'] as const
    for (const name of events) window.addEventListener(name, reset, { passive: true })
    return () => {
      window.clearTimeout(timer)
      for (const name of events) window.removeEventListener(name, reset)
    }
  }, [snapshot.status])

  const getProvider = useCallback(() => getInAppWalletProvider(), [])

  return {
    status: snapshot.status,
    walletInfo: snapshot.walletInfo,
    error: snapshot.error,
    biometricAvailable: snapshot.biometricAvailable,
    biometricEnabled: snapshot.biometricEnabled,
    lockReason: snapshot.lockReason,
    create,
    importExisting,
    unlock,
    unlockWithBiometric,
    enableBiometric,
    disableBiometric,
    lock,
    remove,
    getProvider,
  }
}
