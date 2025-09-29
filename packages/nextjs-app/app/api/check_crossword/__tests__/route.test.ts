import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks de dependencias de base de datos para evitar conexiones reales
const mockExecuteTakeFirst = vi.fn()
class MockKysely {
  constructor(_cfg: any) {}
  selectFrom() { return this }
  where() { return this }
  selectAll() { return this }
  executeTakeFirst() { return mockExecuteTakeFirst() }
}
class MockPostgresDialect { constructor(_cfg: any) {} }
class MockPool { constructor(_cfg: any) {} }

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: MockPostgresDialect
}))

vi.mock('pg', () => ({
  Pool: MockPool
}))

let POST: any
let GET: any

describe('API /api/check_crossword', () => {
  beforeAll(async () => {
    // Importar la ruta después de configurar los mocks
    const route = await import('../route')
    POST = route.POST
    GET = route.GET
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET responde 400 indicando que espera POST', async () => {
    const req = new NextRequest('http://localhost:3000/api/check_crossword', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/Expecting POST/i)
  })

  it('POST sin walletAddress devuelve 200 y mensaje informativo (no califica)', async () => {
    const body = {
      guideId: 'g1',
      lang: 'en',
      prefix: 'p',
      guide: 'intro',
      grid: [],
      placements: [],
      // walletAddress omitido
      token: 'tok'
    }
    const req = new NextRequest('http://localhost:3000/api/check_crossword', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.probs).toEqual([])
    expect(data.message).toMatch(/will not be graded/i)
  })

  it('POST con walletAddress y token que no coincide devuelve mensaje de token', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ billetera: '0xabc', token: 'otro', answer_fib: 'TEST' })
    const body = {
      guideId: 'g1',
      lang: 'en',
      prefix: 'p',
      guide: 'intro',
      grid: [],
      placements: [],
      walletAddress: '0xabc',
      token: 'NOPE'
    }
    const req = new NextRequest('http://localhost:3000/api/check_crossword', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.probs).toEqual([])
    expect(data.message).toMatch(/Token stored for user doesn't match/i)
  })

  it('POST con respuestas correctas produce probs vacío y sin mensaje de error', async () => {
    // billetera con token válido y una palabra
    mockExecuteTakeFirst.mockResolvedValueOnce({ billetera: '0xabc', token: 'TOK', answer_fib: 'TEST' })
    const grid = [
      [
        { userInput: 'T' }, { userInput: 'E' }, { userInput: 'S' }, { userInput: 'T' }
      ]
    ]
    const placements = [
      { row: 0, col: 0, direction: 'across' }
    ]
    const body = {
      guideId: 'g1', lang: 'en', prefix: 'p', guide: 'intro', grid, placements,
      walletAddress: '0xabc', token: 'TOK'
    }
    const req = new NextRequest('http://localhost:3000/api/check_crossword', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.probs).toEqual([])
    expect(data.message).toBe('')
  })

  it('POST con respuestas incorrectas devuelve probs con índice de palabra', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ billetera: '0xabc', token: 'TOK', answer_fib: 'TEST' })
    const grid = [
      [
        { userInput: 'X' }, { userInput: 'E' }, { userInput: 'S' }, { userInput: 'T' }
      ]
    ]
    const placements = [
      { row: 0, col: 0, direction: 'across' }
    ]
    const body = {
      guideId: 'g1', lang: 'en', prefix: 'p', guide: 'intro', grid, placements,
      walletAddress: '0xabc', token: 'TOK'
    }
    const req = new NextRequest('http://localhost:3000/api/check_crossword', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.probs).toEqual([1])
  })
})