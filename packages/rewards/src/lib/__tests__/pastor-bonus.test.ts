import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPublicClient, createWalletClient } from 'viem'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

import { BONUS_AMOUNT, ELIGIBLE_COUNTRIES, MIN_SCORE_FOR_BONUS, isEligiblePastor, awardPastorBonus, type BonusUser } from '../pastor-bonus'

const { mockExecuteTakeFirst, mockExecute, setupMocks, resetMocks, setupCommonResponses } = apiDbMocks

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    createPublicClient: vi.fn(),
    createWalletClient: vi.fn(),
    http: vi.fn(),
  }
})

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({ address: '0xCHURCHES1234567890123456789012345678901234' }),
}))

vi.mock('../abis/SLEARN.json', () => ({ default: [] }))

const mockGetSlearnAddress = vi.fn().mockResolvedValue('0xSLEARN1234567890123456789012345678901234')
vi.mock('../deployments', () => ({
  getSlearnAddress: (...args: unknown[]) => mockGetSlearnAddress(...args),
}))

const CHURCHES_WALLET = '0xCHURCHES1234567890123456789012345678901234'
const PASTOR_WALLET = '0xPASTOR12345678901234567890123456789012345'

function eligiblePastorRow(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    church_relationship: 'pastor',
    pais_id: 694,
    position_israel_gaza: 'no',
    profilescore: 95,
    verified_whatsapp: '23212345678',
    verified_email: 'pastor@example.com',
    verified_city_id: 1,
    verified_church_relationship: 'pastor',
    verified_place_of_worship: 'My Church',
    billetera: PASTOR_WALLET,
    idioma: 'en',
    registration_verified: true,
    church_pastor_id: 1, // el lead (los tests invocan awardPastorBonus(db, 1))
    church_id: 5,
    ...overrides,
  }
}

describe('isEligiblePastor', () => {
  it('returns true for a verified pastor in an eligible country', () => {
    expect(isEligiblePastor(eligiblePastorRow() as BonusUser)).toBe(true)
  })

  it('rejects users who are not pastors', () => {
    expect(isEligiblePastor(eligiblePastorRow({ church_relationship: 'member' }) as BonusUser)).toBe(false)
  })

  it('rejects pastors outside the eligible countries', () => {
    expect(isEligiblePastor(eligiblePastorRow({ pais_id: 45 }) as BonusUser)).toBe(false)
  })

  it('rejects pastors with no country', () => {
    expect(isEligiblePastor(eligiblePastorRow({ pais_id: null }) as BonusUser)).toBe(false)
  })

  it('rejects pastors whose position on Israel/Gaza is not "no"', () => {
    expect(isEligiblePastor(eligiblePastorRow({ position_israel_gaza: 'yes' }) as BonusUser)).toBe(false)
  })

  it('rejects pastors with profile score at or below the threshold', () => {
    expect(isEligiblePastor(eligiblePastorRow({ profilescore: MIN_SCORE_FOR_BONUS }) as BonusUser)).toBe(false)
    expect(isEligiblePastor(eligiblePastorRow({ profilescore: 0 }) as BonusUser)).toBe(false)
  })

  it('documents the bonus constants', () => {
    expect(BONUS_AMOUNT).toBe(44)
    expect(ELIGIBLE_COUNTRIES).toEqual([170, 694])
    expect(MIN_SCORE_FOR_BONUS).toBe(90)
  })
})

describe('awardPastorBonus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    vi.stubEnv('NEXT_PUBLIC_AUTH_URL', 'http://localhost:4000')
    vi.stubEnv('NEXT_PUBLIC_CHURCHES_WALLET_ADDRESS', CHURCHES_WALLET)
    vi.stubEnv('CHURCHES_WALLET_PRIVATE_KEY', '0x81b95d7b9f037ac5f801303a22e4bb2e6c55317ea98201df7f1672d4eebaac5e')
    vi.stubEnv('NEXT_PUBLIC_RPC_URL', 'http://localhost:8545')
  })

  function buildDeps() {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(5000n), // churches fund balance (SLEARN, 2 decimals)
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
    }
    const walletClient = {
      writeContract: vi.fn().mockResolvedValue('0xPASTORBONUSHASH12345678901234567890'),
    }
    vi.mocked(createPublicClient).mockReturnValue(publicClient as any)
    vi.mocked(createWalletClient).mockReturnValue(walletClient as any)
    return { db: new apiDbMocks.MockKysely() as any, publicClient, walletClient }
  }

  it('returns not found when the user does not exist', async () => {
    mockExecuteTakeFirst.mockResolvedValue(null)
    const { db } = buildDeps()
    const result = await awardPastorBonus(db, 999)
    expect(result).toEqual({ awarded: false, reason: 'pastor not found' })
  })

  it('rejects an ineligible user before any on-chain call', async () => {
    mockExecuteTakeFirst.mockResolvedValue(eligiblePastorRow({ church_relationship: 'member' }))
    const { db, walletClient } = buildDeps()
    const result = await awardPastorBonus(db, 1)
    expect(result).toEqual({ awarded: false, reason: 'not eligible' })
    expect(walletClient.writeContract).not.toHaveBeenCalled()
  })

  it('rejects when the church registration is not verified', async () => {
    mockExecuteTakeFirst.mockResolvedValue(eligiblePastorRow({ registration_verified: false }))
    const { db } = buildDeps()
    const result = await awardPastorBonus(db, 1)
    expect(result).toEqual({ awarded: false, reason: 'church not verified' })
  })

  it('rejects when the user is NOT the lead pastor (church.pastor_id)', async () => {
    mockExecuteTakeFirst.mockResolvedValue(eligiblePastorRow({ church_pastor_id: 2 }))
    const { db, walletClient } = buildDeps()
    const result = await awardPastorBonus(db, 1)
    expect(result).toEqual({ awarded: false, reason: 'not the lead pastor of the church' })
    expect(walletClient.writeContract).not.toHaveBeenCalled()
  })

  it('rejects when the user is not verified as lead pastor (co_pastor)', async () => {
    mockExecuteTakeFirst.mockResolvedValue(eligiblePastorRow({ verified_church_relationship: 'co_pastor' }))
    const { db, walletClient } = buildDeps()
    const result = await awardPastorBonus(db, 1)
    expect(result).toEqual({ awarded: false, reason: 'not verified as lead pastor' })
    expect(walletClient.writeContract).not.toHaveBeenCalled()
  })

  it('rejects when the pastor has no wallet', async () => {
    mockExecuteTakeFirst.mockResolvedValue(eligiblePastorRow({ billetera: null }))
    const { db } = buildDeps()
    const result = await awardPastorBonus(db, 1)
    expect(result).toEqual({ awarded: false, reason: 'no wallet' })
  })

  it('does not double-award: returns already awarded when a pastor_bonus exists', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(eligiblePastorRow())
      .mockResolvedValueOnce({ id: 1 }) // existing pastor_bonus transaction
    const { db, walletClient } = buildDeps()
    const result = await awardPastorBonus(db, 1)
    expect(result).toEqual({ awarded: false, reason: 'already awarded' })
    expect(walletClient.writeContract).not.toHaveBeenCalled()
  })

  it('rejects when the churches fund is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_CHURCHES_WALLET_ADDRESS', '')
    mockExecuteTakeFirst
      .mockResolvedValueOnce(eligiblePastorRow())
      .mockResolvedValueOnce(null) // no existing pastor_bonus
    const { db } = buildDeps()
    const result = await awardPastorBonus(db, 1)
    expect(result).toEqual({ awarded: false, reason: 'churches fund not configured' })
  })

  it('rejects when the churches fund balance is below the 44 SLEARN bonus', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(eligiblePastorRow())
      .mockResolvedValueOnce(null) // no existing pastor_bonus
    const { db, publicClient } = buildDeps()
    publicClient.readContract.mockResolvedValue(1000n) // 10.00 SLEARN — insufficient
    const result = await awardPastorBonus(db, 1)
    expect(result.awarded).toBe(false)
    expect(result.reason).toContain('insufficient fund')
  })

  it('transfers 44 SLEARN, records the transaction, verification log, and notification', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(eligiblePastorRow())
      .mockResolvedValueOnce(null) // no existing pastor_bonus
    mockExecute.mockResolvedValue([])
    const { db, publicClient, walletClient } = buildDeps()

    const result = await awardPastorBonus(db, 1)

    expect(result).toEqual({ awarded: true, hash: '0xPASTORBONUSHASH12345678901234567890' })
    // Transfer of 44.00 SLEARN (2 decimals) to the pastor wallet
    expect(walletClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'transfer',
      args: [PASTOR_WALLET, 4400n],
    }))
    expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0xPASTORBONUSHASH12345678901234567890' })
    // transaction + verification_log + notifications rows
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })
})
