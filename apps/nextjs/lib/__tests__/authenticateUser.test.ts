import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

const { mockExecuteTakeFirst, resetMocks, setupCommonResponses } = apiDbMocks

// Simulate the NextAuth session cookie the browser holds after a SIWE login.
let cookieValue: string | null = null
let sessionSub: string | null = null

const mockGetToken = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => (cookieValue ? [{ name: 'next-auth.session-token', value: cookieValue }] : []),
  }),
}))

vi.mock('next-auth/jwt', () => ({
  getToken: (args: any) => mockGetToken(args),
  encode: vi.fn(),
  decode: vi.fn(),
}))

process.env.NEXTAUTH_SECRET = 'test-secret-007'

import { authenticateUser } from '@/lib/authenticateUser'

const BILLETERA = { id: 1, billetera: '0xabcd1234', usuario_id: 42, token: 'rotated-token' }

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

describe('authenticateUser session-cookie fallback', () => {
  beforeEach(() => {
    resetMocks()
    setupCommonResponses()
    cookieValue = 'encrypted-jwt'
    sessionSub = '0xabcd1234'
    mockGetToken.mockReset()
    mockGetToken.mockImplementation(async ({ cookieName }: any) => {
      if (!cookieValue) return null
      return { sub: sessionSub }
    })
  })

  it('accepts a valid token normally (session fallback not invoked)', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ ...BILLETERA, token: 'good-token' })
      .mockResolvedValueOnce({ id: 42, nombre: 'Pastor' })
    const auth = await authenticateUser(mockDb(), '0xabcd1234', 'good-token')
    expect(auth).not.toBeNull()
    expect(auth!.usuario.id).toBe(42)
    expect(mockGetToken).not.toHaveBeenCalled()
  })

  it('falls back to the session cookie when the token was rotated (stale)', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(BILLETERA)            // token-path billetera lookup
      .mockResolvedValueOnce(BILLETERA)            // session-path billetera lookup
      .mockResolvedValueOnce({ id: 42, nombre: 'Pastor' })
    const auth = await authenticateUser(mockDb(), '0xabcd1234', 'stale-token')
    expect(auth).not.toBeNull()
    expect(auth!.usuario.id).toBe(42)
    expect(auth!.billetera.token).toBe('rotated-token')
    expect(mockGetToken).toHaveBeenCalled()
  })

  it('rejects when the session cookie belongs to another wallet', async () => {
    sessionSub = '0xother9999'
    mockExecuteTakeFirst.mockResolvedValueOnce(BILLETERA)
    const auth = await authenticateUser(mockDb(), '0xabcd1234', 'stale-token')
    expect(auth).toBeNull()
  })

  it('rejects with no session cookie and no valid token', async () => {
    cookieValue = null
    mockExecuteTakeFirst.mockResolvedValueOnce(BILLETERA)
    const auth = await authenticateUser(mockDb(), '0xabcd1234', 'stale-token')
    expect(auth).toBeNull()
  })

  it('rejects when the wallet is not registered at all', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined)
    const auth = await authenticateUser(mockDb(), '0xnone0000', 'whatever')
    expect(auth).toBeNull()
  })
})
