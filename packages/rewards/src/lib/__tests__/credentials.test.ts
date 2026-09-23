import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockCredentialsWithRefs, mockDeploymentsWithRefs } from '@pasosdejesus/mpdj/test-utils'

let sharedDb: any

// `sql` es un tagged template en producción; aquí solo hace falta que devuelva
// algo con `execute()` para las consultas agregadas (cursos completados).
const sqlMocks = vi.hoisted(() => ({ mockSqlExecute: vi.fn() }))
vi.mock('kysely', () => ({
  Kysely: vi.fn(),
  PostgresDialect: vi.fn(),
  sql: vi.fn(() => ({ execute: sqlMocks.mockSqlExecute })),
}))

// Credentials module — with refs for assertions
const credRefs = vi.hoisted(() => ({} as Record<string, any>))
vi.mock('@pasosdejesus/mpdj/blockchain', () => {
  const result = mockCredentialsWithRefs()
  Object.assign(credRefs, result.refs)
  return result.module
})

// Deployments module — with refs for assertions
const depRefs = vi.hoisted(() => ({} as Record<string, any>))
vi.mock('@pasosdejesus/m/blockchain/deployments', () => {
  const result = mockDeploymentsWithRefs()
  Object.assign(depRefs, result.refs)
  return result.module
})

const mockGetTokenIdByCourseId = credRefs.getTokenIdByCourseId
const mockHasCredentialOnChain = credRefs.hasCredentialOnChain
const mockMintCourseWithRetry = credRefs.mintCourseWithRetry
const mockGetCeloCredentialsAddress = depRefs.getCeloCredentialsAddress

const mockWaitForTxReceipt = vi.fn().mockResolvedValue({ status: 'success' })
const mockWalletClient = { chain: { id: 11142220 }, account: { address: '0xbackend' } }
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({ waitForTransactionReceipt: mockWaitForTxReceipt })),
  createWalletClient: vi.fn(() => mockWalletClient),
  http: vi.fn(),
}))
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })),
}))
vi.mock('viem/chains', () => ({ celo: { id: 42220 }, celoSepolia: { id: 11142220 } }))
vi.mock('@learn-tg/rewards/lib/config', () => ({ IS_PRODUCTION: false }))

const originalEnv = { ...process.env }
import { mintCourseCredential, revokeCourseCredential, completedCoursesWithoutCredential } from '../credentials'

function createMockDb(executeTakeFirstValues: any[]) {
  let callIdx = 0
  const self: any = {
    _insertInto: null as string | null,
    _updateTable: null as string | null,
    selectFrom() { return self },
    select() { return self },
    where() { return self },
    orderBy() { return self },
    innerJoin() { return self },
    leftJoin() { return self },
    insertInto(table: string) { self._insertInto = table; return self },
    updateTable(table: string) { self._updateTable = table; return self },
    set() { return self },
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

    const result = await mintCourseCredential(sharedDb, 1, 3, '0x123')

    expect(result).toBeNull()
    expect(mockMintCourseWithRetry).not.toHaveBeenCalled()
  })

  it('returns null when already on-chain (backfills cache)', async () => {
    sharedDb = createMockDb([null, null]) // no cache, then metadata for backfill
    mockHasCredentialOnChain.mockResolvedValue(true)

    const result = await mintCourseCredential(sharedDb, 1, 3, '0x123')

    expect(result).toBeNull()
    expect(sharedDb._insertInto).toBe('credential_emission')
    expect(mockMintCourseWithRetry).not.toHaveBeenCalled()
  })

  it('mints a new credential and records emission', async () => {
    sharedDb = createMockDb([null, { is_premium: false }])

    const result = await mintCourseCredential(sharedDb, 1, 3, '0x123')

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

    const result = await mintCourseCredential(sharedDb, 1, 1, '0x456')

    expect(result!.isPremium).toBe(true)
  })

  it('throws when mintCourseWithRetry fails', async () => {
    sharedDb = createMockDb([null])
    mockMintCourseWithRetry.mockRejectedValue(new Error('tx failed after retries'))

    await expect(mintCourseCredential(sharedDb, 1, 3, '0x123')).rejects.toThrow('tx failed after retries')
  })

  it('throws when contract address is not configured', async () => {
    sharedDb = createMockDb([])
    mockGetCeloCredentialsAddress.mockReturnValue(null)

    await expect(mintCourseCredential(sharedDb, 1, 3, '0x123')).rejects.toThrow('Credentials contract not configured')
  })

  it('uses testnet chain when IS_PRODUCTION is false', async () => {
    sharedDb = createMockDb([null, { is_premium: false }])

    await mintCourseCredential(sharedDb, 2, 102, '0x789')

    expect(mockMintCourseWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ chain: { id: 11142220 } })
    )
  })

  it('returns null when courseId not registered (tokenId is 0)', async () => {
    sharedDb = createMockDb([null])
    mockGetTokenIdByCourseId.mockResolvedValue(0)

    const result = await mintCourseCredential(sharedDb, 1, 999, '0x123')

    expect(result).toBeNull()
    expect(mockMintCourseWithRetry).not.toHaveBeenCalled()
  })
})

// Auto-revocación (https://github.com/pasosdeJesus/learn.tg/issues/259 §3.5).
// El contrato exige MINTER_ROLE, que es la billetera del backend.
describe('revokeCourseCredential', () => {
  const WALLET = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'
  const CONTRACT = '0x593f4486Fc7F3403e01a9c71E90ceE5DaD84A439'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    process.env.NEXT_PUBLIC_RPC_URL = 'http://localhost:8545'
    mockGetCeloCredentialsAddress.mockReturnValue(CONTRACT)
    credRefs.revokeCredential.mockResolvedValue('0xmockrevoketx')
  })
  afterEach(() => { process.env = { ...originalEnv } })

  it('burns on chain and marks the emission as revoked', async () => {
    sharedDb = createMockDb([{ numUpdatedRows: 1n }])

    const result = await revokeCourseCredential(sharedDb, 191, 3, WALLET)

    expect(result.txHash).toBe('0xmockrevoketx')
    expect(credRefs.revokeCredential).toHaveBeenCalledWith(
      mockWalletClient,
      CONTRACT,
      WALLET,
      3,
      1,
    )
    expect(mockWaitForTxReceipt).toHaveBeenCalled()
    expect(sharedDb._updateTable).toBe('credential_emission')
  })

  it('fails loudly when the user has no emission row to revoke', async () => {
    sharedDb = createMockDb([{ numUpdatedRows: 0n }])

    await expect(revokeCourseCredential(sharedDb, 191, 3, WALLET))
      .rejects.toThrow('Credential emission row not found for this user')
  })

  it('throws when the contract address is not configured', async () => {
    sharedDb = createMockDb([])
    mockGetCeloCredentialsAddress.mockReturnValue(null)

    await expect(revokeCourseCredential(sharedDb, 191, 3, WALLET))
      .rejects.toThrow('Credentials contract not configured')
  })
})

// Base del opt-in tardío: cursos completados al 100% sin credencial
// (https://github.com/pasosdeJesus/learn.tg/issues/259 §3.4).
describe('completedCoursesWithoutCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sqlMocks.mockSqlExecute.mockResolvedValue({ rows: [] })
  })

  it('maps rows and flags Christian content as a boolean', async () => {
    sqlMocks.mockSqlExecute.mockResolvedValue({
      rows: [
        { course_id: 10, titulo: 'Global Disciples', contenido_cristiano: true },
        { course_id: '7', titulo: null, contenido_cristiano: false },
      ],
    })

    const courses = await completedCoursesWithoutCredential({} as any, 191)

    expect(courses).toEqual([
      { courseId: 10, titulo: 'Global Disciples', contenido_cristiano: true },
      { courseId: 7, titulo: null, contenido_cristiano: false },
    ])
  })

  it('returns an empty list when there is nothing pending', async () => {
    sqlMocks.mockSqlExecute.mockResolvedValue({ rows: [] })

    await expect(completedCoursesWithoutCredential({} as any, 191)).resolves.toEqual([])
  })
})
