// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

const { mockExecuteTakeFirst, resetMocks, setupCommonResponses } = apiDbMocks

// El setup global simula `@/lib/authenticateUser` para las pruebas de rutas;
// esta prueba ejercita la implementación real (session-only).
vi.unmock('@/lib/authenticateUser')

// Simulate the NextAuth session cookie the browser holds after a SIWE login.
let cookieValue: string | null = null

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => (cookieValue ? [{ name: 'next-auth.session-token', value: cookieValue }] : []),
  }),
}))

process.env.NEXTAUTH_SECRET = 'test-secret-007'

import { authenticateUser } from '@/lib/authenticateUser'
import { encode } from 'next-auth/jwt'

const BILLETERA = { id: 1, billetera: '0xabcd1234', usuario_id: 42 }

// Chainable mock DB whose executeTakeFirst delegates to mockExecuteTakeFirst
function mockDb(): any {
  const chain: any = {}
  chain.selectFrom = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.selectAll = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.orderBy = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.executeTakeFirst = () => mockExecuteTakeFirst()
  return chain
}

async function sessionCookie(sub: string): Promise<string> {
  return encode({
    token: { sub },
    secret: process.env.NEXTAUTH_SECRET as string,
  })
}

describe('authenticateUser (session-only, R-#233 Fase 2)', () => {
  beforeEach(async () => {
    resetMocks()
    setupCommonResponses()
    // Real NextAuth JWT, as produced by the SIWE login
    cookieValue = await sessionCookie('0xabcd1234')
  })

  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret-007'
  })

  it('authenticates by session cookie', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(BILLETERA)                     // billetera lookup
      .mockResolvedValueOnce({ id: 42, nombre: 'Pastor' })   // usuario lookup
    const auth = await authenticateUser(mockDb(), '0xabcd1234')
    expect(auth).not.toBeNull()
    expect(auth!.usuario.id).toBe(42)
  })

  it('rejects when there is no session cookie', async () => {
    cookieValue = null
    const auth = await authenticateUser(mockDb(), '0xabcd1234')
    expect(auth).toBeNull()
  })

  it('rejects when the session cookie belongs to another wallet', async () => {
    cookieValue = await sessionCookie('0xother9999')
    const auth = await authenticateUser(mockDb(), '0xabcd1234')
    expect(auth).toBeNull()
  })

  it('rejects when the wallet is not registered at all', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined)
    const auth = await authenticateUser(mockDb(), '0xnone0000')
    expect(auth).toBeNull()
  })

  it('rejects when the wallet hint is missing', async () => {
    const auth = await authenticateUser(mockDb())
    expect(auth).toBeNull()
  })
})
