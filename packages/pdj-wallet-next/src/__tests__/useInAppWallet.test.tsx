import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const walletMock = vi.hoisted(() => ({
  hasWallet: vi.fn(),
  getWalletInfo: vi.fn(),
  createWallet: vi.fn(),
  importWallet: vi.fn(),
  unlockWallet: vi.fn(),
  lockWallet: vi.fn(),
  deleteWallet: vi.fn(),
  getInAppWalletProvider: vi.fn(),
}))

vi.mock('@learn-tg/pdj-wallet', () => walletMock)

import { useInAppWallet, resetInAppWalletStoreForTests } from '../useInAppWallet'

const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`
const INFO = { address: ADDRESS, chain: 'celoSepolia' as const, createdAt: 1 }

describe('useInAppWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetInAppWalletStoreForTests()
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
