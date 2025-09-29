import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
// Import diferido de GET tras mocks
let GET: any

// La ruta real espera: courseId, lang, prefix, guide, walletAddress?, token?
// Si falta walletAddress, agrega mensaje pero sigue procesando.
// Si faltan parámetros clave (lang/prefix/guide) readFile falla y devuelve 500.

// Mock fs para devolver markdown controlado
vi.mock('fs/promises', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    readFile: vi.fn(() => Promise.resolve('# Crossword Source\n\nTexto con blanks'))
  }
})

// Mock remarkFillInTheBlank para poblar global.fillInTheBlank
vi.mock('@/lib/remarkFillInTheBlank.mjs', () => ({
  remarkFillInTheBlank: () => () => { (global as any).fillInTheBlank = [
    { answer: 'TEST', clue: 'A test word' },
    { answer: 'CODE', clue: 'Programming stuff' }
  ] }
}))

// Mock crossword layout generator
vi.mock('crossword-layout-generator-with-isolated', () => ({
  __esModule: true,
  default: {
    generateLayout: (scrambled: any[]) => ({
      rows: 5,
      cols: 5,
      table: Array(5).fill(null).map(() => Array(5).fill('-')),
      table_string: '-----<br>-----',
      result: scrambled.map((e, i) => ({
        answer: e.answer,
        clue: e.clue,
        startx: 1 + i,
        starty: 1,
        orientation: i % 2 === 0 ? 'across' : 'down'
      }))
    })
  }
}))

// Mock Kysely (solo las partes usadas en la ruta)
vi.mock('kysely', () => {
  class FakeKysely {
    selectFrom() { return this }
    where() { return this }
    selectAll() { return this }
    executeTakeFirst() { return Promise.resolve({ id: 1, token: 'tok123' }) }
    updateTable() { return { set: () => ({ where: () => ({ execute: () => Promise.resolve([]) }) }) } }
  }
  class PostgresDialect { constructor(_cfg: any) {} }
  return { Kysely: FakeKysely, PostgresDialect }
})

describe('API /api/crossword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  beforeAll(async () => {
    const mod = await import('../route')
    GET = mod.GET
  })

  it('retorna grid y placements con parámetros completos y wallet', async () => {
    const url = new URL('http://localhost:3000/api/crossword?courseId=c1&lang=en&prefix=a-relationship-with-Jesus&guide=intro&walletAddress=0xabc&token=tok123')
    const request = new NextRequest(url)
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('grid')
    expect(data).toHaveProperty('placements')
    expect(Array.isArray(data.placements)).toBe(true)
    expect(data.message).toBe('')
  })

  it('retorna mensaje si falta walletAddress pero sigue con 200', async () => {
    const url = new URL('http://localhost:3000/api/crossword?courseId=c1&lang=en&prefix=a-relationship-with-Jesus&guide=intro')
    const request = new NextRequest(url)
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.message).toMatch(/connect your web3 Wallet/i)
  })

  it('retorna 200 aún si faltan parámetros clave (comportamiento actual)', async () => {
    const url = new URL('http://localhost:3000/api/crossword')
    const request = new NextRequest(url)
    const response = await GET(request)
    expect(response.status).toBe(200)
  })

  it('maneja error forzado de fs (readFile) pero termina respondiendo 200', async () => {
    const { readFile } = await import('fs/promises')
    ;(readFile as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('FS fail'))
    const url = new URL('http://localhost:3000/api/crossword?courseId=c1&lang=en&prefix=a-relationship-with-Jesus&guide=intro&walletAddress=0xabc&token=tok123')
    const request = new NextRequest(url)
    const response = await GET(request)
    expect(response.status).toBe(200)
  })
})