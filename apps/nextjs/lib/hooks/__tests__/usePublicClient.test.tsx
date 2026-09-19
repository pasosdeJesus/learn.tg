// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  provider: null as { request: () => Promise<unknown> } | null,
}))

vi.mock('@/lib/hooks/useWalletProvider', () => ({
  useWalletProvider: () => ({
    provider: mocks.provider,
    isInApp: false,
    isInAppUnlocked: false,
    externalAvailable: !!mocks.provider,
  }),
}))

vi.mock('@/lib/rpc-url', () => ({ getRpcUrl: () => 'https://rpc.example' }))

import { usePublicClient } from '../useWallet'

describe('usePublicClient (lecturas)', () => {
  beforeEach(() => {
    mocks.provider = null
  })

  // Bug 2026-09-19: con la billetera in-app bloqueada y sin billetera inyectada el
  // cliente era null y los modales no podían leer saldos (mostraban 0).
  it('falls back to the chain RPC when there is no wallet available', () => {
    const { result } = renderHook(() => usePublicClient())
    expect(result.current).not.toBeNull()
    expect(result.current!.transport.type).toBe('http')
  })

  // Los specs E2E parchean `eth_getBalance` del proveedor inyectado para simular
  // saldos y gas: con un proveedor disponible las lecturas deben pasar por él.
  it('uses the available provider when there is one', () => {
    mocks.provider = { request: async () => '0x1' }
    const { result } = renderHook(() => usePublicClient())
    expect(result.current).not.toBeNull()
    expect(result.current!.transport.type).toBe('custom')
  })
})
