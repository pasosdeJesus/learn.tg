'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  createWallet,
  deleteWallet,
  detectPlatformSupport,
  disableBiometricUnlock,
  emitAccountsChanged,
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
 * Dropping the key means the next action asks for the gesture (or the password on
 * devices without WebAuthn).
 *
 * One hour, not ten minutes: the operator's mobile test had to unlock again
 * while donating on `/[lang]/gdcluster/ranking` less than ten minutes after
 * unlocking, and OneKey waits about an hour after its own fingerprint prompt.
 * The value only bounds how long the in-memory key survives a pause; moving
 * funds is always gated by layer L1 (a fresh gesture), so a longer pause cannot
 * make a transfer silent. An operator or the user changing the value is
 * https://github.com/pasosdeJesus/learn.tg/issues/248.
 */
export const INACTIVITY_LOCK_MS = 60 * 60 * 1000
// Distinto de `USER_VERIFICATION_GRACE_MS` del core (15 min, R-#253): el auto-lock
// es por inactividad (una hora) y, al llamar a `lockWallet()`, cierra la ventana de
// gracia para que el próximo movimiento vuelva a pedir el gesto.

/**
 * Minimum time between two inactivity resets. Activity events arrive in bursts
 * (a scroll fires dozens of them), and restarting the timer on each one is
 * wasted work on the low-end phones this audience uses.
 */
const ACTIVITY_RESET_THROTTLE_MS = 5 * 1000

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
  create: (password: string) => Promise<{ walletInfo: WalletInfo; mnemonic: string }>
  importExisting: (options: ImportWalletOptions) => Promise<WalletInfo>
  unlock: (password: string) => Promise<WalletInfo>
  /** Unlocks with one user-verified WebAuthn gesture (needs `biometricEnabled`). */
  unlockWithBiometric: () => Promise<WalletInfo>
  /** Registers a passkey and seals the key with its PRF secret. Needs the password. */
  enableBiometric: (password: string) => Promise<void>
  disableBiometric: () => Promise<void>
  lock: () => Promise<void>
  remove: () => Promise<void>
  /**
   * The EIP-1193 provider of the unlocked wallet. `rpcUrl` is required for
   * anything that talks to the chain: reads (`eth_call`, `eth_getBalance`…) and
   * broadcasts are forwarded to it.
   */
  getProvider: (rpcUrl?: string) => Eip1193Provider | null
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
    // which is why the biometric path exists: one gesture instead of the password.
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

  const create = useCallback(async (password: string) => {
    setState({ error: null })
    try {
      const result = await createWallet({ password })
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

  const unlock = useCallback(async (password: string) => {
    setState({ error: null })
    try {
      const info = await unlockWallet(password)
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

  const enableBiometric = useCallback(async (password: string) => {
    setState({ error: null })
    try {
      await enableBiometricUnlock(password)
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
    // R-#236: quien esté suscrito al proveedor se entera de que la sesión terminó.
    emitAccountsChanged([])
    setState({ status: 'locked', lockReason: 'user' })
  }, [])

  const remove = useCallback(async () => {
    await deleteWallet()
    emitAccountsChanged([])
    setState({ walletInfo: null, status: 'no-wallet', biometricEnabled: false, lockReason: 'deleted' })
  }, [])

  // R-#246: auto-lock tras inactividad (como OneKey y OKX). Suelta la clave en
  // memoria; NO cierra la sesión (el motivo lo distingue `WalletEventListener`).
  // `visibilitychange` se escucha en `document` (no burbujea hasta `window`, que
  // era el defecto que dejaba el temporizador corriendo en el teléfono), y el
  // reinicio se limita a uno cada pocos segundos para que `scroll` no lo agite.
  useEffect(() => {
    if (snapshot.status !== 'unlocked') return
    const lockForIdle = () => {
      void lockWallet()
      emitAccountsChanged([])
      setState({ status: 'locked', lockReason: 'idle' })
    }
    let timer = window.setTimeout(lockForIdle, INACTIVITY_LOCK_MS)
    let lastReset = Date.now()
    const reset = () => {
      const now = Date.now()
      if (now - lastReset < ACTIVITY_RESET_THROTTLE_MS) return
      lastReset = now
      window.clearTimeout(timer)
      timer = window.setTimeout(lockForIdle, INACTIVITY_LOCK_MS)
    }
    const events = ['pointerdown', 'keydown', 'touchstart', 'click', 'scroll'] as const
    for (const name of events) {
      window.addEventListener(name, reset, { passive: true })
    }
    const onVisibilityChange = () => {
      lastReset = 0
      reset()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearTimeout(timer)
      for (const name of events) window.removeEventListener(name, reset)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [snapshot.status])

  const getProvider = useCallback((rpcUrl?: string) => getInAppWalletProvider({ rpcUrl }), [])

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
