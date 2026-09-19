import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const walletMock = vi.hoisted(() => ({
  hasWallet: vi.fn(),
  getWalletInfo: vi.fn(),
  createWallet: vi.fn(),
  importWallet: vi.fn(),
  unlockWallet: vi.fn(),
  unlockWithBiometric: vi.fn(),
  enableBiometricUnlock: vi.fn(),
  disableBiometricUnlock: vi.fn(),
  hasBiometricUnlock: vi.fn(),
  detectPlatformSupport: vi.fn(),
  lockWallet: vi.fn(),
  deleteWallet: vi.fn(),
  getInAppWalletProvider: vi.fn(),
}))

vi.mock('@learn-tg/pdj-wallet', () => walletMock)

import { useInAppWallet, resetInAppWalletStoreForTests, INACTIVITY_LOCK_MS } from '../useInAppWallet'

const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`
const INFO = { address: ADDRESS, chain: 'celoSepolia' as const, createdAt: 1 }

describe('useInAppWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetInAppWalletStoreForTests()
    // `clearAllMocks` does not revert implementations: pin them so one test does
    // not leave the wallet unlocked (or biometric) for the next one.
    walletMock.hasBiometricUnlock.mockResolvedValue(false)
    walletMock.detectPlatformSupport.mockResolvedValue({ webauthn: false, userVerifying: false, prf: null })
    ;(globalThis as { indexedDB?: unknown }).indexedDB = {}
    window.indexedDB = {} as IDBFactory
  })

  it('reports no-wallet when there is nothing stored', async () => {
    walletMock.hasWallet.mockResolvedValue(false)
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('no-wallet'))
    expect(result.current.walletInfo).toBeNull()
  })

  it('reports locked when a wallet exists', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    expect(result.current.walletInfo?.address).toBe(ADDRESS)
  })

  // R-#246: el desbloqueo vive en memoria, así que recargar vuelve a pedirlo.
  // Lo que evita teclear el PIN es el camino biométrico.
  it('reports the biometric capability of the device', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    walletMock.detectPlatformSupport.mockResolvedValue({ webauthn: true, userVerifying: true, prf: true })
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    expect(result.current.biometricAvailable).toBe(true)
    expect(result.current.biometricEnabled).toBe(false)
  })

  it('stays locked and PIN-only on devices without WebAuthn', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    walletMock.detectPlatformSupport.mockResolvedValue({ webauthn: false, userVerifying: false, prf: null })
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    expect(result.current.biometricAvailable).toBe(false)
  })

  it('reports biometric as enabled when a sealed key exists', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    walletMock.hasBiometricUnlock.mockResolvedValue(true)
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    expect(result.current.biometricEnabled).toBe(true)
    expect(result.current.biometricAvailable).toBe(true)
  })

  it('unlocks with one gesture', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    walletMock.hasBiometricUnlock.mockResolvedValue(true)
    walletMock.unlockWithBiometric.mockResolvedValue(INFO)
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    await act(async () => {
      await result.current.unlockWithBiometric()
    })
    expect(result.current.status).toBe('unlocked')
    expect(result.current.walletInfo?.address).toBe(ADDRESS)
  })

  it('records the error and keeps the wallet locked when the gesture fails', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    walletMock.unlockWithBiometric.mockRejectedValue(new Error('auth-failed'))
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    await act(async () => {
      await expect(result.current.unlockWithBiometric()).rejects.toThrow('auth-failed')
    })
    expect(result.current.status).toBe('locked')
    expect(result.current.error).toBe('auth-failed')
  })

  it('enables and disables the biometric unlock', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))

    await act(async () => {
      await result.current.enableBiometric('123456')
    })
    expect(walletMock.enableBiometricUnlock).toHaveBeenCalledWith('123456')
    expect(result.current.biometricEnabled).toBe(true)

    await act(async () => {
      await result.current.disableBiometric()
    })
    expect(result.current.biometricEnabled).toBe(false)
  })

  it('goes to unlocked after creating a wallet', async () => {
    walletMock.hasWallet.mockResolvedValue(false)
    walletMock.createWallet.mockResolvedValue({ walletInfo: INFO, mnemonic: 'one two three' })
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('no-wallet'))
    await act(async () => {
      await result.current.create('123456')
    })
    expect(result.current.status).toBe('unlocked')
    expect(result.current.walletInfo?.address).toBe(ADDRESS)
  })

  // R-#246: auto-lock por inactividad, como OneKey y OKX. Suelta la clave pero no
  // cierra la sesión (el motivo `idle` lo distingue WalletEventListener).
  it('locks the wallet after inactivity and marks the reason as idle', async () => {
    vi.useFakeTimers()
    try {
      walletMock.hasWallet.mockResolvedValue(true)
      walletMock.getWalletInfo.mockResolvedValue(INFO)
      walletMock.unlockWallet.mockResolvedValue(INFO)
      const { result } = renderHook(() => useInAppWallet())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await result.current.unlock('123456')
      })
      expect(result.current.status).toBe('unlocked')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(INACTIVITY_LOCK_MS + 1)
      })

      expect(walletMock.lockWallet).toHaveBeenCalled()
      expect(result.current.status).toBe('locked')
      expect(result.current.lockReason).toBe('idle')
    } finally {
      vi.useRealTimers()
    }
  })

  // El temporizador debe reiniciarse con la actividad real de un teléfono:
  // `visibilitychange` se emite en `document`, no en `window` (R-#246).
  it('restarts the inactivity timer when the tab becomes visible again', async () => {
    vi.useFakeTimers()
    try {
      walletMock.hasWallet.mockResolvedValue(true)
      walletMock.getWalletInfo.mockResolvedValue(INFO)
      walletMock.unlockWallet.mockResolvedValue(INFO)
      const { result } = renderHook(() => useInAppWallet())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await result.current.unlock('123456')
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(INACTIVITY_LOCK_MS - 1000)
      })
      document.dispatchEvent(new Event('visibilitychange'))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(result.current.status).toBe('unlocked')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(INACTIVITY_LOCK_MS)
      })
      expect(result.current.status).toBe('locked')
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks the reason as user when the header ✕ locks it', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    walletMock.unlockWallet.mockResolvedValue(INFO)
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    await act(async () => {
      await result.current.unlock('123456')
    })
    await act(async () => {
      await result.current.lock()
    })
    expect(result.current.lockReason).toBe('user')
  })

  it('goes to unlocked after importing and back to locked after locking', async () => {
    walletMock.hasWallet.mockResolvedValue(false)
    walletMock.importWallet.mockResolvedValue(INFO)
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('no-wallet'))
    await act(async () => {
      await result.current.importExisting({ mnemonic: 'one two three', pin: '123456' })
    })
    expect(result.current.status).toBe('unlocked')
    expect(walletMock.importWallet).toHaveBeenCalledWith({ mnemonic: 'one two three', pin: '123456' })
    await act(async () => {
      await result.current.lock()
    })
    expect(result.current.status).toBe('locked')
    expect(result.current.walletInfo?.address).toBe(ADDRESS)
  })

  it('records the error and rethrows when unlocking fails', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    walletMock.unlockWallet.mockRejectedValue(new Error('Wrong PIN or corrupted wallet data'))
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    await act(async () => {
      await expect(result.current.unlock('000000')).rejects.toThrow(/Wrong PIN/)
    })
    expect(result.current.error).toMatch(/Wrong PIN/)
  })

  it('takes the provider from the core package', async () => {
    walletMock.hasWallet.mockResolvedValue(false)
    const provider = { request: vi.fn() }
    walletMock.getInAppWalletProvider.mockReturnValue(provider)
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('no-wallet'))
    expect(result.current.getProvider()).toBe(provider)
  })

  it('removes the wallet', async () => {
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
    const { result } = renderHook(() => useInAppWallet())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    await act(async () => {
      await result.current.remove()
    })
    expect(walletMock.deleteWallet).toHaveBeenCalled()
    expect(result.current.status).toBe('no-wallet')
  })

  // Sin estado compartido, `InAppWalletSetup` desbloqueaba la billetera y el
  // componente que lo contenía seguía viendo `locked`: la interfaz parecía no
  // hacer nada.
  it('shares the state between instances (setup and consumer agree)', async () => {
    walletMock.hasWallet.mockResolvedValue(false)
    walletMock.createWallet.mockResolvedValue({ walletInfo: INFO, mnemonic: 'one two three' })
    const setup = renderHook(() => useInAppWallet())
    const consumer = renderHook(() => useInAppWallet())

    await waitFor(() => expect(consumer.result.current.status).toBe('no-wallet'))
    await act(async () => {
      await setup.result.current.create('123456')
    })

    expect(setup.result.current.status).toBe('unlocked')
    expect(consumer.result.current.status).toBe('unlocked')
    expect(consumer.result.current.walletInfo?.address).toBe(ADDRESS)

    await act(async () => {
      await consumer.result.current.lock()
    })
    expect(setup.result.current.status).toBe('locked')
  })
})
