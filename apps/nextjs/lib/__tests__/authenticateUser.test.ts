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

/** Token con las reclamaciones extra de R-#265 §3.8 / R-#250 (`usuarioId`, época). */
async function sessionCookieWith(claims: Record<string, unknown>): Promise<string> {
  return encode({
    token: claims,
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

  // R-#265 §3.8: la sesión identifica la **cuenta**, no la billetera.
  it('accepts any wallet of the account the session belongs to', async () => {
    cookieValue = await sessionCookieWith({ sub: '0xaaa1111', usuarioId: 42 })
    // La pista (0xbbb2222) es otra billetera de la MISMA cuenta 42.
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 2, billetera: '0xbbb2222', usuario_id: 42 })
      .mockResolvedValueOnce({ id: 42, nombre: 'Pastor', session_epoch: 0 })
    const auth = await authenticateUser(mockDb(), '0xbbb2222')
    expect(auth).not.toBeNull()
    expect(auth!.usuario.id).toBe(42)
  })

  it('rejects a wallet hint that is not part of the session account', async () => {
    cookieValue = await sessionCookieWith({ sub: '0xaaa1111', usuarioId: 42 })
    mockExecuteTakeFirst.mockResolvedValueOnce({ id: 3, billetera: '0xbbb2222', usuario_id: 99 })
    const auth = await authenticateUser(mockDb(), '0xbbb2222')
    expect(auth).toBeNull()
  })

  // R-#250: subir la época corta todas las sesiones de la cuenta.
  it('rejects a session whose epoch was revoked', async () => {
    cookieValue = await sessionCookieWith({ sub: '0xaaa1111', usuarioId: 42, sessionEpoch: 0 })
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 2, billetera: '0xbbb2222', usuario_id: 42 })
      .mockResolvedValueOnce({ id: 42, nombre: 'Pastor', session_epoch: 3 })
    const auth = await authenticateUser(mockDb(), '0xbbb2222')
    expect(auth).toBeNull()
  })

  it('accepts a session whose epoch matches', async () => {
    cookieValue = await sessionCookieWith({ sub: '0xaaa1111', usuarioId: 42, sessionEpoch: 3 })
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 2, billetera: '0xbbb2222', usuario_id: 42 })
      .mockResolvedValueOnce({ id: 42, nombre: 'Pastor', session_epoch: 3 })
    const auth = await authenticateUser(mockDb(), '0xbbb2222')
    expect(auth).not.toBeNull()
  })
})
