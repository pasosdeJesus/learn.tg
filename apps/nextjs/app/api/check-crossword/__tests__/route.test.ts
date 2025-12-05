import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks de dependencias de base de datos para evitar conexiones reales
const mockExecuteTakeFirst = vi.fn()
const mockExecute = vi.fn()
class MockKysely {
  constructor(_cfg: any) {}
  selectFrom() {
    return this
  }
  where() {
    return this
  }
  selectAll() {
    return this
  }
  executeTakeFirst() {
    return mockExecuteTakeFirst()
  }
  orderBy() {
    return this
  }
  limit() {
    return this
  }
  select() {
    return this
  }
  insertInto() {
    return this
  }
  values() {
    return this
  }
  returningAll() {
    return this
  }
  execute() {
    return mockExecute()
  }
  executeTakeFirstOrThrow() {
    return mockExecuteTakeFirst()
  }
}
class MockPostgresDialect {
  constructor(_cfg: any) {}
}
class MockPool {
  constructor(_cfg: any) {}
}

const mockSql = {
  execute: vi.fn(),
}

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: MockPostgresDialect,
  sql: vi.fn(() => mockSql),
}))

vi.mock('pg', () => ({
  Pool: MockPool,
}))

// Mock the config loader to return our mock db
vi.mock('@/.config/kysely.config.ts', () => ({
  newKyselyPostgresql: () => new MockKysely({}),
}))

// Mock viem to prevent actual blockchain interactions
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem')
  return {
    ...actual, // Use actual implementations for most functions
    createPublicClient: vi.fn(() => ({})),
    createWalletClient: vi.fn(() => ({
      sendTransaction: vi.fn().mockResolvedValue('0xmocktxhash'),
      getChainId: vi.fn().mockResolvedValue(44787), // Celo Alfajores
    })),
    getContract: vi.fn(() => ({
      address: '0xmockContractAddress',
      read: {
        vaults: vi.fn().mockResolvedValue([0n, 0n, 0n, 0n, 0n, 1n]), // vault.exists = true (index 5)
        studentCanSubmit: vi.fn().mockResolvedValue(true),
      },
    })),
    encodeFunctionData: vi.fn(() => '0xmockEncodedData'),
    http: vi.fn(), // Mock http transport
  }
})

let POST: any
let GET: any

describe('API /api/check-crossword', () => {
  beforeAll(async () => {
    // Importar la ruta después de configurar los mocks
    const route = await import('../route')
    POST = route.POST
    GET = route.GET
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Set dummy environment variables for tests that need to simulate contract interaction
    process.env.PRIVATE_KEY =
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    process.env.NEXT_PUBLIC_DEPLOYED_AT =
      '0x5FbDB2315678afecb367f032d93F642f64180aa3'

    // Reset mocks for each test
    mockExecuteTakeFirst.mockReset()
    mockExecute.mockReset()
    mockSql.execute.mockClear()
    mockSql.execute.mockResolvedValue({
      // Default mock for sql.execute
      rows: [{ id: 101 }, { id: 102 }],
    })
  })

  it('GET responde 400 indicando que espera POST', async () => {
    const req = new NextRequest('http://localhost:3000/api/check-crossword', {
      method: 'GET',
    })
    const res = await GET(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/Expecting POST/i)
  })

  it('POST sin walletAddress devuelve 400 y mensaje informativo (no califica)', async () => {
    const body = {
      guideId: 1,
      courseId: 1,
      lang: 'en',
      prefix: 'p',
      guide: 'intro',
      grid: [],
      placements: [],
      // walletAddress omitido
      token: 'tok',
    }
    const req = new NextRequest('http://localhost:3000/api/check-crossword', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
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
      answer_fib: 'TEST',
    })
    const body = {
      guideId: 1,
      courseId: 1,
      lang: 'en',
      prefix: 'p',
      guide: 'intro',
      grid: [],
      placements: [],
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      token: 'NOPE',
    }
    const req = new NextRequest('http://localhost:3000/api/check-crossword', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/Token stored for user doesn't match/i)
  })

  it('POST con respuestas correctas produce probs vacío y sin mensaje de error', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({
        billetera: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        usuario_id: 1,
        token: 'TOK',
        answer_fib: 'TEST',
      }) // for billetera_usuario
      .mockResolvedValueOnce({ id: 1, profilescore: 60 }) // for usuario
    mockExecute.mockResolvedValueOnce([]) // for guide_usuario check (ug)
    mockExecuteTakeFirst.mockResolvedValueOnce({ points: 1 }) // for insert into guide_usuario

    const grid = [
      [
        { userInput: 'T' },
        { userInput: 'E' },
        { userInput: 'S' },
        { userInput: 'T' },
      ],
    ]
    const placements = [{ row: 0, col: 0, direction: 'across' }]
    const body = {
      courseId: 1,
      guideId: 1,
      lang: 'en',
      prefix: 'p',
      guide: 'intro',
      grid,
      placements,
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      token: 'TOK',
    }
    const req = new NextRequest('http://localhost:3000/api/check-crossword', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.mistakesInCW).toEqual([])
    expect(data.message).toContain('Correct answer')
    expect(data.scholarshipResult).toBe('0xmocktxhash')
  })

  it('POST con respuestas incorrectas devuelve probs con índice de palabra', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({
        billetera: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        usuario_id: 1,
        token: 'TOK',
        answer_fib: 'TEST',
      }) // for billetera_usuario
      .mockResolvedValueOnce({ id: 1, profilescore: 60 }) // for usuario
    mockExecute.mockResolvedValue([]) // for guide_usuario check (ug)

    const grid = [
      [
        { userInput: 'X' },
        { userInput: 'E' },
        { userInput: 'S' },
        { userInput: 'T' },
      ],
    ]
    const placements = [{ row: 0, col: 0, direction: 'across' }]
    const body = {
      courseId: 1,
      guideId: 1,
      lang: 'en',
      prefix: 'p',
      guide: 'intro',
      grid,
      placements,
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      token: 'TOK',
    }
    const req = new NextRequest('http://localhost:3000/api/check-crossword', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.mistakesInCW).toEqual([1])
    expect(data.message).toContain('Wrong answer')
    expect(data.scholarshipResult).toBe('0xmocktxhash')
  })
})
