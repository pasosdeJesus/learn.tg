import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

import { premiumPurchase } from '../premium-purchase'

const { mockExecuteTakeFirst, mockExecute, setupMocks, resetMocks, setupCommonResponses } = apiDbMocks

// Mock only the parts of viem the route/verifyTransfer touch; keep formatUnits real.
const { decodeFunctionData } = vi.hoisted(() => ({ decodeFunctionData: vi.fn() }))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, decodeFunctionData }
})

vi.mock('../abis/SLEARN.json', () => ({ default: [] }))

const mockGetSlearnAddress = vi.fn().mockResolvedValue('0xSLEARN1234567890123456789012345678901234')
vi.mock('../../lib/deployments', () => ({
  getSlearnAddress: (...args: unknown[]) => mockGetSlearnAddress(...args),
}))

const BACKEND_WALLET = '0xBACKEND123456789012345678901234567890123456'
const USDT_ADDRESS = '0xUSDTADDR12345678901234567890123456789012'
const SLEARN_ADDRESS = '0xSLEARN1234567890123456789012345678901234'
const WALLET = '0x1234567890abcdef1234567890abcdef12345678'
const TOKEN = 'valid-token'
const USDT_HASH = '0x' + 'ab'.repeat(32)
const SLEARN_HASH = '0x' + 'cd'.repeat(32)
const USDT_DECIMALS = 6
const SLEARN_DECIMALS = 2
const USDT_AMOUNT = 2500000n // 2.5 USDT
const SLEARN_AMOUNT = 2200n // 22 SLEARN

// MockKysely does not implement the onConflict()/doNothing() insert chain used
// by the premium enrollment insert — extend it locally.
class PremiumDb extends apiDbMocks.MockKysely {
  onConflict(): this { return this }
  doNothing(): this { return this }
}

function buildDeps(overrides: Record<string, any> = {}): any {
  const publicClient = {
    getBlock: vi.fn().mockResolvedValue({ timestamp: BigInt(Math.floor(Date.now() / 1000)) }),
    readContract: vi.fn().mockImplementation(({ functionName }: any) => {
      if (functionName === 'usdtToSlearnRate') return Promise.resolve(22n)
      if (functionName === 'allowance') return Promise.resolve(0n)
      return Promise.resolve(0n)
    }),
    getTransactionCount: vi.fn().mockResolvedValue(5n),
  }
  const walletClient = {
    account: { address: BACKEND_WALLET },
  }
  const sendTxAndWait = vi.fn().mockResolvedValue('0xPROCESSPAYMENTHASH12345678901234567890')
  const fetchTxWithReceipt = vi.fn().mockResolvedValue({
    receipt: { status: 'success', to: USDT_ADDRESS, blockNumber: 100n },
    tx: { from: WALLET, input: '0xa9059cbb' + '00'.repeat(28) },
  })
  const deps: any = {
    db: () => new PremiumDb(),
    authenticateUser: vi.fn().mockResolvedValue({
      usuario: { id: 1, profilescore: 90, pais_id: 170 },
      billetera: { billetera: WALLET },
    }),
    recordEvent: vi.fn(),
    backend: {
      getPublicClient: () => publicClient,
      getWalletClient: () => walletClient,
      getBackendWallet: () => BACKEND_WALLET,
      getUsdtAddress: async () => USDT_ADDRESS,
      getUsdtDecimals: () => USDT_DECIMALS,
      getChain: () => ({ id: 11142220 }),
      sendTxAndWait,
      fetchTxWithReceipt,
      MAX_TX_AGE: 86400000,
      SLEARN_RATE: 22,
      SLEARN_DECIMALS,
    },
    routeReward: vi.fn(async (ctx: any) => { ctx.destino = undefined }),
    routeToClusterFunds: vi.fn().mockResolvedValue({}),
    canPurchasePremiumCourse: vi.fn().mockResolvedValue({ access: true }),
    updateUserAndCoursePoints: vi.fn().mockResolvedValue(0),
    ...overrides,
  }
  return deps
}

describe('premiumPurchase (motor rewards)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    vi.stubEnv('NEXT_PUBLIC_AUTH_URL', 'http://localhost:4000')
    vi.stubEnv('NEXT_PUBLIC_RPC_URL', 'http://localhost:8545')
    decodeFunctionData.mockReturnValue({
      functionName: 'transfer',
      args: [BACKEND_WALLET, USDT_AMOUNT],
    })
    mockExecuteTakeFirst
      .mockResolvedValueOnce(null) // replay check: no existing tx
      .mockResolvedValueOnce(null) // alreadyOwned: no enrollment
      .mockResolvedValueOnce({ pais_id: 170 }) // user country
      .mockResolvedValueOnce({ hdi: 0.467 }) // m_hdi → $2 price
    mockExecute.mockResolvedValue([])
  })

  function createRequest(body: any): NextRequest {
    return new NextRequest('http://localhost/api/courses/premium/purchase', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  it('returns 400 when required parameters are missing', async () => {
    const res = await premiumPurchase(buildDeps(), createRequest({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Missing required parameters')
  })

  it('returns 400 when no payment hash is provided', async () => {
    const res = await premiumPurchase(buildDeps(), createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1,
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('payment transaction hash')
  })

  it('returns 401 when authentication fails', async () => {
    const deps = buildDeps()
    deps.authenticateUser.mockResolvedValue(null)
    const res = await premiumPurchase(deps, createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1, usdtHash: USDT_HASH,
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when the payment hash was already processed (replay)', async () => {
    mockExecuteTakeFirst.mockReset()
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 7 }) // replay hit
    const res = await premiumPurchase(buildDeps(), createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1, usdtHash: USDT_HASH,
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Transaction already processed')
  })

  it('returns 400 when the course was already purchased', async () => {
    mockExecuteTakeFirst.mockReset()
    mockExecuteTakeFirst
      .mockResolvedValueOnce(null) // replay
      .mockResolvedValueOnce({ id: 1 }) // enrollment exists
    const res = await premiumPurchase(buildDeps(), createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1, usdtHash: USDT_HASH,
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Course already purchased')
  })

  it('returns 400 when the on-chain transfer failed', async () => {
    const deps = buildDeps()
    deps.backend.fetchTxWithReceipt.mockResolvedValue({
      receipt: { status: 'reverted', to: USDT_ADDRESS, blockNumber: 100n },
      tx: { from: WALLET, input: '0xa9059cbb' },
    })
    const res = await premiumPurchase(deps, createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1, usdtHash: USDT_HASH,
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('USDT transfer failed on-chain')
  })

  it('returns 400 when the payment is below the country price', async () => {
    decodeFunctionData.mockReturnValue({
      functionName: 'transfer',
      args: [BACKEND_WALLET, 1000000n], // 1.0 USDT < $2
    })
    const res = await premiumPurchase(buildDeps(), createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1, usdtHash: USDT_HASH,
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Insufficient payment')
  })

  it('returns 403 when the user is not eligible to purchase the course', async () => {
    const deps = buildDeps()
    deps.canPurchasePremiumCourse.mockResolvedValue({ access: false, reason: 'verified_city_required' })
    const res = await premiumPurchase(deps, createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1, usdtHash: USDT_HASH,
    }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('verified_city_required')
  })

  it('purchases a non-GD course with USDT and records the payment rows', async () => {
    const deps = buildDeps()
    const res = await premiumPurchase(deps, createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1, usdtHash: USDT_HASH,
    }))
    const body = await res.json()
    expect(body, `status=${res.status} body=${JSON.stringify(body)}`).toEqual(expect.objectContaining({ message: 'Course purchased' }))
    expect(res.status).toBe(200)
    const json = body
    expect(json.message).toBe('Course purchased')
    expect(json.access).toBe(true)
    expect(json.processPaymentHash).toBe('0xPROCESSPAYMENTHASH12345678901234567890')
    // processPayment with 50% pdJ split (non-GD), full amount
    expect(deps.backend.sendTxAndWait).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(),
      expect.objectContaining({
        functionName: 'processPayment',
        args: [WALLET, USDT_AMOUNT, 0n, 1n, 50n, 10n, 10n, 5n, 10n, 5n],
      }),
    )
    // pay-course (usdt) + donation_reward cashback + premium_course_usuario enrollment
    expect(mockExecute).toHaveBeenCalledTimes(3)
    // distribution is 50/10/10/5/10/5 + vault remainder = 10%
    const cashback = json.distribution.find((d: any) => d.destination === 'cashback')
    expect(cashback.amount).toBeCloseTo(5.5, 2) // 2.5 USDT × 10% × rate 22
  })

  it('purchases a GD course routing 10% to the country/cluster fund', async () => {
    const deps = buildDeps({
      routeReward: vi.fn(async (ctx: any) => {
        ctx.destino = 'SL'
        ctx.gdUsdtAmount = 250000n // 10% of 2.5 USDT
        ctx.gdSlearnAmount = 0n
      }),
    })
    const res = await premiumPurchase(deps, createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1, usdtHash: USDT_HASH,
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.access).toBe(true)
    // 10% routed to ClusterFundsV2 first
    expect(deps.routeToClusterFunds).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(),
      USDT_HASH, 'SL', 250000n, 0n, USDT_ADDRESS, SLEARN_ADDRESS,
    )
    // processPayment receives the remaining 90% with 40% pdJ split (GD)
    expect(deps.backend.sendTxAndWait).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(),
      expect.objectContaining({
        functionName: 'processPayment',
        args: [WALLET, 2250000n, 0n, 1n, 40n, 10n, 10n, 5n, 10n, 5n],
      }),
    )
    // country_fund shows 10% of the value
    const countryFund = json.distribution.find((d: any) => d.destination === 'country_fund')
    expect(countryFund.amount).toBeCloseTo(0.25, 2)
  })

  it('purchases with a mixed USDT + SLEARN payment', async () => {
    decodeFunctionData
      .mockReturnValueOnce({ functionName: 'transfer', args: [BACKEND_WALLET, USDT_AMOUNT] })
      .mockReturnValueOnce({ functionName: 'transfer', args: [BACKEND_WALLET, SLEARN_AMOUNT] })
    const deps = buildDeps()
    // Two hashes → checkReplayAttack runs one query per hash
    mockExecuteTakeFirst
      .mockReset()
      .mockResolvedValueOnce(null) // replay usdtHash
      .mockResolvedValueOnce(null) // replay slearnHash
      .mockResolvedValueOnce(null) // alreadyOwned
      .mockResolvedValueOnce({ pais_id: 170 }) // user country
      .mockResolvedValueOnce({ hdi: 0.467 }) // m_hdi → $2 price
    deps.backend.fetchTxWithReceipt.mockImplementation((hash: string) => Promise.resolve(
      hash === USDT_HASH
        ? { receipt: { status: 'success', to: USDT_ADDRESS, blockNumber: 100n }, tx: { from: WALLET, input: '0xa9059cbb' } }
        : { receipt: { status: 'success', to: SLEARN_ADDRESS, blockNumber: 100n }, tx: { from: WALLET, input: '0xa9059cbb' } },
    ))
    const res = await premiumPurchase(deps, createRequest({
      walletAddress: WALLET, token: TOKEN, courseId: 1, usdtHash: USDT_HASH, slearnHash: SLEARN_HASH,
    }))
    const json = await res.json()
    expect(json, `status=${res.status} body=${JSON.stringify(json)}`).toEqual(expect.objectContaining({ access: true }))
    expect(deps.backend.sendTxAndWait).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(),
      expect.objectContaining({
        functionName: 'processPayment',
        args: [WALLET, USDT_AMOUNT, SLEARN_AMOUNT, 1n, 50n, 10n, 10n, 5n, 10n, 5n],
      }),
    )
    // pay-course rows for usdt + slearn + cashback reward + enrollment = 4 rows
    expect(mockExecute).toHaveBeenCalledTimes(4)
  })
})
