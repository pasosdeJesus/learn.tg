// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { parseAbi } from 'viem'

const { mockUseWalletProvider, mockUseAuthAddress } = vi.hoisted(() => ({
  mockUseWalletProvider: vi.fn(),
  mockUseAuthAddress: vi.fn(),
}))
vi.mock('@/lib/hooks/useWalletProvider', () => ({
  useWalletProvider: mockUseWalletProvider,
}))
vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: mockUseAuthAddress,
}))

import { useWriteContract } from '@/lib/hooks/useWriteContract'

// El proveedor in-app llena nonce y gas a partir de `tx.from`
// (`fillTransaction`): sin `from` el RPC responde "Invalid params" (-32602) y el
// reclamo de GoodDollar con la billetera in-app fallaba así (operador, 2026-10-01).
describe('useWriteContract', () => {
  const address = '0xAbC0000000000000000000000000000000000001'
  const claimAbi = parseAbi(['function claim()'])
  let provider: { request: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    provider = { request: vi.fn().mockResolvedValue('0xhash') }
    mockUseWalletProvider.mockReturnValue({ provider })
    mockUseAuthAddress.mockReturnValue({ address })
  })

  it('sends eth_sendTransaction with from, to and data', async () => {
    const { result } = renderHook(() => useWriteContract())

    await act(async () => {
      await result.current.writeContract({
        address: '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1',
        abi: claimAbi,
        functionName: 'claim',
      })
    })

    expect(provider.request).toHaveBeenCalledWith({
      method: 'eth_sendTransaction',
      params: [
        expect.objectContaining({
          from: address,
          to: '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1',
          data: expect.stringMatching(/^0x4e71d92d/),
        }),
      ],
    })
  })

  it('throws when there is no provider', async () => {
    mockUseWalletProvider.mockReturnValue({ provider: null })
    const { result } = renderHook(() => useWriteContract())

    await expect(
      result.current.writeContract({
        address: '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1',
        abi: claimAbi,
        functionName: 'claim',
      }),
    ).rejects.toThrow('No wallet available')
  })
})
