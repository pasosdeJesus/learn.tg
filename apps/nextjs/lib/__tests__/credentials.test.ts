import { describe, it, expect, vi, beforeEach } from 'vitest'

let sharedDb: any

vi.mock('kysely', () => ({ Kysely: vi.fn(), PostgresDialect: vi.fn() }))
vi.mock('@/.config/kysely.config', () => ({
  newKyselyPostgresql: vi.fn(() => sharedDb),
}))

const {
  mockGetTokenIdByCourseId,
  mockHasCredentialOnChain,
  mockGetCeloCredentialsAddress,
  mockMintCourseWithRetry,
} = vi.hoisted(() => ({
  mockGetTokenIdByCourseId: vi.fn(),
  mockHasCredentialOnChain: vi.fn(),
  mockGetCeloCredentialsAddress: vi.fn(),
  mockMintCourseWithRetry: vi.fn(),
}))

vi.mock('@pasosdejesus/m/blockchain', () => ({
  getTokenIdByCourseId: mockGetTokenIdByCourseId,
  hasCredentialOnChain: mockHasCredentialOnChain,
  getCeloCredentialsAddress: mockGetCeloCredentialsAddress,
  mintCourseWithRetry: mockMintCourseWithRetry,
}))

const mockWaitForTxReceipt = vi.fn().mockResolvedValue({ status: 'success' })
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({ waitForTransactionReceipt: mockWaitForTxReceipt })),
  createWalletClient: vi.fn(),
  http: vi.fn(),
}))
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })),
}))
vi.mock('viem/chains', () => ({ celo: { id: 42220 }, celoSepolia: { id: 11142220 } }))
vi.mock('@/lib/config', () => ({ IS_PRODUCTION: false }))

const originalEnv = { ...process.env }
import { mintCourseCredential } from '../credentials'

function createMockDb(executeTakeFirstValues: any[]) {
  let callIdx = 0
  const self: any = {
    _insertInto: null as string | null,
    selectFrom() { return self },
    select() { return self },
    where() { return self },
    orderBy() { return self },
    innerJoin() { return self },
    insertInto(table: string) { self._insertInto = table; return self },
    values() { return self },
    onConflict() { return self },
    doNothing() { return self },
    executeTakeFirst() {
      const val = callIdx < executeTakeFirstValues.length
        ? executeTakeFirstValues[callIdx]
        : null
      callIdx++
      return Promise.resolve(val)
    },
    execute: vi.fn().mockResolvedValue(undefined),
  }
  return self
}

describe('mintCourseCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    process.env.NEXT_PUBLIC_RPC_URL = 'http://localhost:8545'
    mockGetCeloCredentialsAddress.mockReturnValue('0x593f4486Fc7F3403e01a9c71E90ceE5DaD84A439')
    mockGetTokenIdByCourseId.mockResolvedValue(3)
    mockHasCredentialOnChain.mockResolvedValue(false)
    mockMintCourseWithRetry.mockResolvedValue('0xabctransactionhash123')
  })
  afterEach(() => { process.env = { ...originalEnv } })

  it('returns null when already emitted (off-chain cache hit)', async () => {
    sharedDb = createMockDb([{ id: 1 }])

    const result = await mintCourseCredential(1, 3, '0x123')

    expect(result).toBeNull()
    expect(mockMintCourseWithRetry).not.toHaveBeenCalled()
  })

  it('returns null when already on-chain (backfills cache)', async () => {
    sharedDb = createMockDb([null, null]) // no cache, then metadata for backfill
    mockHasCredentialOnChain.mockResolvedValue(true)

    const result = await mintCourseCredential(1, 3, '0x123')

    expect(result).toBeNull()
    expect(sharedDb._insertInto).toBe('credential_emission')
    expect(mockMintCourseWithRetry).not.toHaveBeenCalled()
  })

  it('mints a new credential and records emission', async () => {
    sharedDb = createMockDb([null, { is_premium: false }])

    const result = await mintCourseCredential(1, 3, '0x123')

    expect(result).not.toBeNull()
    expect(result!.tokenId).toBe(3)
    expect(result!.txHash).toBe('0xabctransactionhash123')
    expect(result!.isPremium).toBe(false)
    expect(mockMintCourseWithRetry).toHaveBeenCalledTimes(1)
    expect(mockMintCourseWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 3, userAddress: '0x123' })
    )
    expect(mockWaitForTxReceipt).toHaveBeenCalled()
    expect(sharedDb._insertInto).toBe('credential_emission')
  })

  it('records premium status from credential_metadata', async () => {
    sharedDb = createMockDb([null, { is_premium: true }])
    mockGetTokenIdByCourseId.mockResolvedValue(5)

    const result = await mintCourseCredential(1, 1, '0x456')

    expect(result!.isPremium).toBe(true)
  })

  it('throws when mintCourseWithRetry fails', async () => {
    sharedDb = createMockDb([null])
    mockMintCourseWithRetry.mockRejectedValue(new Error('tx failed after retries'))

    await expect(mintCourseCredential(1, 3, '0x123')).rejects.toThrow('tx failed after retries')
  })

  it('throws when contract address is not configured', async () => {
    sharedDb = createMockDb([])
    mockGetCeloCredentialsAddress.mockReturnValue(null)

    await expect(mintCourseCredential(1, 3, '0x123')).rejects.toThrow('Credentials contract not configured')
  })

  it('uses testnet chain when IS_PRODUCTION is false', async () => {
    sharedDb = createMockDb([null, { is_premium: false }])

    await mintCourseCredential(2, 102, '0x789')

    expect(mockMintCourseWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ chain: { id: 11142220 } })
    )
  })
})
