import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

const mockExecuteTakeFirst = vi.fn()
const mockExecute = vi.fn()
const mockUpdateTable = vi.fn(() => ({
  set: mockSet,
  where: vi.fn().mockReturnThis(),
  execute: vi.fn(),
}))
const mockSet = vi.fn().mockReturnThis()

class MockKysely {
  selectFrom() { return this }
  where() { return this }
  selectAll() { return this }
  executeTakeFirst() { return mockExecuteTakeFirst() }
  orderBy() { return this }
  limit() { return this }
  select() { return this }
  insertInto() { return this }
  values() { return this }
  returningAll() { return this }
  execute() { return mockExecute() }
  executeTakeFirstOrThrow() { return mockExecuteTakeFirst() }
  updateTable() { return mockUpdateTable() }
}

const mockSql = {
  execute: vi.fn(),
}

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
  sql: vi.fn(() => mockSql),
}))

vi.mock('pg', () => ({
  Pool: vi.fn(),
}))

vi.mock('@/.config/kysely.config.ts', () => ({
  newKyselyPostgresql: () => new MockKysely(),
}))

const mockGetContract = vi.fn()
const mockSendTransaction = vi.fn().mockResolvedValue('0xmocktxhash')
const mockWaitForTransactionReceipt = vi.fn()
const mockGetStudentGuideStatus = vi.fn()

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    })),
    createWalletClient: vi.fn(() => ({
      sendTransaction: mockSendTransaction,
    })),
    getContract: mockGetContract,
    encodeFunctionData: vi.fn(() => '0xmockEncodedData'),
    http: vi.fn(),
  }
})

let POST: any, GET: any

describe('API /api/check-crossword', () => {
  beforeAll(async () => {
    const route = await import('../route')
    POST = route.POST
    GET = route.GET
  })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    process.env.NEXT_PUBLIC_DEPLOYED_AT = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

    mockSql.execute.mockResolvedValue({ rows: [{ id: 101, sufijoRuta: 'test-guide' }] })

    mockGetContract.mockReturnValue({
      address: '0xmockContractAddress',
      read: {
        vaults: vi.fn().mockResolvedValue([0n, 0n, 0n, 0n, 0n, 1n]),
        studentCanSubmit: vi.fn().mockResolvedValue(true),
        getStudentGuideStatus: mockGetStudentGuideStatus,
      },
      write: {
        submitGuideResult: vi.fn().mockResolvedValue('0xmocktxhash'),
      },
    })
  })

  it('POST con respuestas correctas actualiza amountpaid desde el contrato', async () => {
    const PAID_AMOUNT = BigInt(500000000000000000) // 0.5 USDT en formato BigInt

    mockExecuteTakeFirst
      .mockResolvedValueOnce({ billetera: '0x123', usuario_id: 1, token: 'TOK', answer_fib: 'TEST' })
      .mockResolvedValueOnce({ id: 1, profilescore: 60 })
    mockExecute.mockResolvedValueOnce([])
    mockExecuteTakeFirst.mockResolvedValueOnce({ points: 1 })
    mockGetStudentGuideStatus.mockResolvedValueOnce([PAID_AMOUNT, true])
    mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' })

    const body = {
      courseId: 1, guideId: 1, lang: 'en', grid: [[{ userInput: 'T' }, { userInput: 'E' }, { userInput: 'S' }, { userInput: 'T' }]],
      placements: [{ row: 0, col: 0, direction: 'across' }], walletAddress: '0x123', token: 'TOK'
    }
    const req = new NextRequest('http://localhost/api/check-crossword', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.mistakesInCW).toEqual([])
    expect(data.scholarshipResult).toBe('0xmocktxhash')
    expect(mockUpdateTable).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith({ amountpaid: PAID_AMOUNT.toString() })
  })

  it('GET responde 400 indicando que espera POST', async () => {
    const req = new NextRequest('http://localhost:3000/api/check-crossword', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/Expecting POST/i)
  })

  it('POST sin walletAddress devuelve 400 y mensaje informativo (no califica)', async () => {
    const body = { courseId: 1, guideId: 1, lang: 'en', grid: [], placements: [], token: 'tok' }
    const req = new NextRequest('http://localhost:3000/api/check-crossword', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/will not be graded/i)
  })

  it('POST con walletAddress y token que no coincide devuelve mensaje de token', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ 
      billetera: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 
      token: 'otro', 
      answer_fib: 'TEST' 
    })
    const body = { 
      guideId: 1, courseId: 1, lang: 'en', grid: [], placements: [], 
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', token: 'NOPE'
    }
    const req = new NextRequest('http://localhost:3000/api/check-crossword', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/Token stored for user doesn\'t match/i)
  })

  it('POST con respuestas incorrectas devuelve probs con índice de palabra', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ 
        billetera: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 
        usuario_id: 1, token: 'TOK', answer_fib: 'TEST' 
      })
      .mockResolvedValueOnce({ id: 1, profilescore: 60 })
    mockExecute.mockResolvedValue([])
    mockGetStudentGuideStatus.mockResolvedValueOnce([0n, true])

    const grid = [[{ userInput: 'X' }, { userInput: 'E' }, { userInput: 'S' }, { userInput: 'T' }]]
    const placements = [{ row: 0, col: 0, direction: 'across' }]
    const body = { 
      courseId: 1, guideId: 1, lang: 'en', grid, placements, 
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', token: 'TOK' 
    }
    const req = new NextRequest('http://localhost:3000/api/check-crossword', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.mistakesInCW).toEqual([1])
    expect(data.message).toContain('Wrong answer')
    expect(data.scholarshipResult).toBe('0xmocktxhash')
  })
})

