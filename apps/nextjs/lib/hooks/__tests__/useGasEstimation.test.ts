// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGasEstimation, type UseGasEstimationOptions } from '../useGasEstimation'

// El barrel @pasosdejesus/m/debug (DebugConsole.js) crashea el worker de Node en
// OpenBSD (Check failed: result.ptr != nullptr); el hook lo usa solo para loguear.
vi.mock('@pasosdejesus/m/debug', () => ({
  logger: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(), debug: vi.fn() },
}))

const ADDRESS = '0x1234567890123456789012345678901234567890'
const BACKEND = '0xBACKEND123456789012345678901234567890123456'
const USDT = '0xUSDTADDR12345678901234567890123456789012'
const SLEARN = '0xSLEARN1234567890123456789012345678901234'

// Clientes estables: se crean UNA vez por test y se pasan como overrides.
// No recrearlos dentro del callback de renderHook — el efecto del hook depende
// de su identidad; objetos nuevos por render → bucle infinito de efectos que
// tumba el worker (V8 fatal en OpenBSD).
function makeClients({ estimateError }: { estimateError?: Error } = {}) {
  return {
    publicClient: {
      getGasPrice: vi.fn().mockResolvedValue(500000000n), // 0.5 gwei
      estimateContractGas: estimateError
        ? vi.fn().mockRejectedValue(estimateError)
        : vi.fn().mockResolvedValue(60000n), // 60k gas units per transfer
    },
    walletClient: { getChainId: vi.fn().mockResolvedValue(11142220) },
  }
}

function props(overrides: Record<string, any> = {}): UseGasEstimationOptions {
  return {
    amount: '1.0',
    slearnAmount: '0',
    usdtDecimals: 6,
    address: ADDRESS,
    walletClient: undefined,
    publicClient: undefined,
    backendWalletAddress: BACKEND,
    usdtAddress: USDT,
    slearnAddress: SLEARN,
    courseId: 1,
    celoBalance: 10n ** 18n, // 1 CELO
    ...overrides,
  }
}

describe('useGasEstimation (diagnóstico de gas)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_AUTH_URL', 'http://localhost:4000')
  })

  it('returns idle and no diagnostics when there is nothing to pay', async () => {
    const { result } = renderHook(() => useGasEstimation(props({ amount: '0', slearnAmount: '0' })))
    await waitFor(() => expect(result.current.gasState).toBe('idle'))
    expect(result.current.diag?.state).toBe('idle')
    expect(result.current.diag?.hasUsdt).toBe(false)
  })

  it('classifies as no-gas with reason when the wallet is missing', async () => {
    const { result } = renderHook(() => useGasEstimation(props({ address: undefined })))
    await waitFor(() => expect(result.current.gasState).toBe('no-gas'))
    expect(result.current.diag?.reason).toBe('no-address')
  })

  it('classifies as no-gas with reason when the public client is missing', async () => {
    const { walletClient } = makeClients()
    const { result } = renderHook(() => useGasEstimation(props({ walletClient, publicClient: undefined })))
    await waitFor(() => expect(result.current.gasState).toBe('no-gas'))
    expect(result.current.diag?.reason).toBe('no-public-client')
  })

  it('classifies as ok when the CELO balance covers the estimated cost', async () => {
    const clients = makeClients()
    const { result } = renderHook(() => useGasEstimation(props(clients)))
    await waitFor(() => expect(result.current.gasState).toBe('ok'))
    const d = result.current.diag!
    expect(d.sufficient).toBe(true)
    expect(d.celoBalanceCELO).toBe('1') // 1 CELO
    expect(d.walletChainId).toBe('11142220')
    expect(d.gasPriceGwei).toBe('0.50')
    // cost = 60000 gas × 0.5 gwei = 0.00003 CELO
    expect(d.totalGas).toBe('60000')
    expect(d.estimatedCostCELO).toBe('0.00003')
    expect([42220, 11142220]).toContain(d.appChainId)
  })

  it('classifies as no-gas when the CELO balance does not cover the cost', async () => {
    const clients = makeClients()
    const { result } = renderHook(() => useGasEstimation(props({ ...clients, celoBalance: 10n ** 13n }))) // 0.00001 CELO
    await waitFor(() => expect(result.current.gasState).toBe('no-gas'))
    expect(result.current.diag?.sufficient).toBe(false)
    expect(result.current.diag?.celoBalanceCELO).toBe('0.00001')
  })

  it('estimates both tokens and sums the gas', async () => {
    const clients = makeClients()
    const { result } = renderHook(() => useGasEstimation(props({
      ...clients,
      slearnAmount: '5.0',
      amount: '1.0',
    })))
    await waitFor(() => expect(result.current.gasState).toBe('ok'))
    expect(result.current.diag?.totalGas).toBe('120000') // 60000 + 60000
    expect(result.current.diag?.usdtTransferGas).toBe('60000')
    expect(result.current.diag?.slearnTransferGas).toBe('60000')
  })

  it('falls back to no-gas when gas estimation fails and the balance is tiny', async () => {
    const clients = makeClients({ estimateError: new Error('insufficient funds for gas') })
    const { result } = renderHook(() => useGasEstimation(props({ ...clients, celoBalance: 10n ** 13n })))
    await waitFor(() => expect(result.current.gasState).toBe('no-gas'))
    expect(result.current.diag?.error).toContain('insufficient funds')
    expect(result.current.diag?.fallbackNoGas).toBe(true)
  })

  it('falls back to warn when gas estimation fails but the balance is meaningful', async () => {
    const clients = makeClients({ estimateError: new Error('boom') })
    const { result } = renderHook(() => useGasEstimation(props({ ...clients, celoBalance: 10n ** 18n })))
    await waitFor(() => expect(result.current.gasState).toBe('warn'))
    expect(result.current.diag?.fallbackNoGas).toBe(false)
  })
})
