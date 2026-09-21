// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  session: null as { address?: string } | null,
  sessionStatus: 'authenticated',
  inAppStatus: 'no-wallet' as 'no-wallet' | 'locked' | 'unlocked',
  inAppWalletInfo: null as { address?: string } | null,
  provider: null as { request: (args: { method: string }) => Promise<unknown> } | null,
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mocks.session, status: mocks.sessionStatus }),
}))

vi.mock('@learn-tg/pdj-wallet-next', () => ({
  useInAppWallet: () => ({ status: mocks.inAppStatus, walletInfo: mocks.inAppWalletInfo }),
}))

vi.mock('@/lib/external-provider', () => ({
  useExternalProvider: () => ({ provider: mocks.provider }),
}))

vi.mock('@pasosdejesus/m/debug', () => ({
  logger: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

import { useAuthAddress } from '../useAuthAddress'

const STORED = '0xstored0000000000000000000000000000000001'
const SESSION = '0xSession000000000000000000000000000000002'
const INAPP = '0xInApp00000000000000000000000000000000003'

describe('useAuthAddress', () => {
  beforeEach(() => {
    mocks.session = null
    mocks.sessionStatus = 'authenticated'
    mocks.inAppStatus = 'no-wallet'
    mocks.inAppWalletInfo = null
    mocks.provider = null
    localStorage.clear()
  })

  // Precedencia documentada: session ∥ billetera in-app ∥ localStorage (#5719).
  it('prefers the NextAuth session over the in-app wallet and localStorage', () => {
    mocks.session = { address: SESSION }
    mocks.inAppStatus = 'unlocked'
    mocks.inAppWalletInfo = { address: INAPP }
    localStorage.setItem('learn.tg.sessionAddress', STORED)

    const { result } = renderHook(() => useAuthAddress())

    expect(result.current.address).toBe(SESSION)
    expect(result.current.sessionAddress).toBe(SESSION)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('uses the in-app wallet while it is unlocked when there is no session', () => {
    mocks.inAppStatus = 'unlocked'
    mocks.inAppWalletInfo = { address: '0xAbC0000000000000000000000000000000000004' }
    localStorage.setItem('learn.tg.sessionAddress', STORED)

    const { result } = renderHook(() => useAuthAddress())

    // Dirección en minúsculas y `isInAppUnlocked` para que la UI distinga la fuente.
    expect(result.current.address).toBe('0xabc0000000000000000000000000000000000004')
    expect(result.current.inAppAddress).toBe('0xabc0000000000000000000000000000000000004')
    expect(result.current.isInAppUnlocked).toBe(true)
  })

  it('falls back to localStorage when there is neither session nor unlocked wallet', async () => {
    localStorage.setItem('learn.tg.sessionAddress', STORED)

    const { result } = renderHook(() => useAuthAddress())

    // R-#218: localStorage no se lee en el primer render (hidratación); se expone
    // tras montar, que es lo que asegura este test.
    await waitFor(() => expect(result.current.storedAddress).toBe(STORED))
    expect(result.current.address).toBe(STORED)
    expect(result.current.sessionAddress).toBeUndefined()
    expect(result.current.isInAppUnlocked).toBe(false)
  })

  it('reports the session as loading while NextAuth resolves the cookie', () => {
    mocks.sessionStatus = 'loading'

    const { result } = renderHook(() => useAuthAddress())

    expect(result.current.isSessionLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('counts the unlocked in-app wallet as an available wallet', () => {
    mocks.inAppStatus = 'unlocked'
    mocks.inAppWalletInfo = { address: INAPP }

    const { result } = renderHook(() => useAuthAddress())

    expect(result.current.isWalletAvailable).toBe(true)
  })

  it('marks the wallet available only when the provider reports accounts', async () => {
    mocks.provider = { request: vi.fn(async () => ['0x1']) }

    const { result } = renderHook(() => useAuthAddress())

    await waitFor(() => expect(result.current.isWalletCheckComplete).toBe(true))
    expect(result.current.isWalletAvailable).toBe(true)
    expect(mocks.provider.request).toHaveBeenCalledWith({ method: 'eth_accounts' })
  })

  it('marks the wallet unavailable when the provider has no connected accounts', async () => {
    mocks.provider = { request: vi.fn(async () => []) }

    const { result } = renderHook(() => useAuthAddress())

    await waitFor(() => expect(result.current.isWalletCheckComplete).toBe(true))
    expect(result.current.isWalletAvailable).toBe(false)
  })
})
