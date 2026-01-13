import { describe, it, expect, beforeEach, vi } from 'vitest'
import { authOptions } from '../auth-options'

// Mock modules with hoisted variables to avoid initialization issues
const {
  mockSiweMessage,
  mockGetCsrfToken,
  mockSubmitReferral,
  mockSql,
  mockKysely,
  mockExecuteTakeFirst,
  mockExecute,
  mockSelectFrom,
  mockInsertInto,
  mockUpdateTable
} = vi.hoisted(() => {
  // Mock Kysely database
  const mockExecuteTakeFirst = vi.fn()
  const mockExecute = vi.fn()
  const mockSelectFrom = vi.fn(() => ({
    where: vi.fn(() => ({
      selectAll: vi.fn(() => ({
        executeTakeFirst: mockExecuteTakeFirst
      }))
    }))
  }))
  const mockInsertInto = vi.fn(() => ({
    values: vi.fn(() => ({
      returningAll: vi.fn(() => ({
        executeTakeFirstOrThrow: vi.fn()
      }))
    }))
  }))
  const mockUpdateTable = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        execute: vi.fn()
      }))
    }))
  }))

  const mockSql = {
    val: vi.fn((val) => val),
    execute: vi.fn()
  }

  const mockKysely = {
    selectFrom: mockSelectFrom,
    insertInto: mockInsertInto,
    updateTable: mockUpdateTable
  }

  return {
    mockSiweMessage: vi.fn(),
    mockGetCsrfToken: vi.fn(),
    mockSubmitReferral: vi.fn(),
    mockSql,
    mockKysely,
    // Export helper mocks for use in tests
    mockExecuteTakeFirst,
    mockExecute,
    mockSelectFrom,
    mockInsertInto,
    mockUpdateTable
  }
})

// Mock modules using hoisted mocks
vi.mock('siwe', () => ({
  SiweMessage: mockSiweMessage
}))

vi.mock('next-auth/react', () => ({
  getCsrfToken: mockGetCsrfToken
}))

vi.mock('@divvi/referral-sdk', () => ({
  submitReferral: mockSubmitReferral
}))

vi.mock('@/.config/kysely.config', () => ({
  newKyselyPostgresql: vi.fn(() => mockKysely)
}))

vi.mock('kysely', () => ({
  sql: Object.assign(
    vi.fn(() => mockSql),
    { val: mockSql.val }
  )
}))

describe('authOptions', () => {
  // mockSiweMessage, mockGetCsrfToken, mockSubmitReferral are already available from hoisted mocks

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset all mocks to default behavior
    mockGetCsrfToken.mockResolvedValue('mock-csrf-token')
    mockExecuteTakeFirst.mockResolvedValue(null)
    mockSql.execute.mockResolvedValue({ rows: [] })
    mockSiweMessage.mockClear()
    // Default mock implementation
    mockSiweMessage.mockImplementation(() => ({
      address: '0xdefault',
      verify: vi.fn().mockResolvedValue({ success: false, data: { nonce: 'mock-nonce', chainId: 1 } })
    }))
    // Set default environment variable
    process.env.NEXT_PUBLIC_AUTH_URL = 'http://localhost:3000'
  })

  it('should have Ethereum credential provider', () => {
    expect(authOptions.providers).toHaveLength(1)
    expect(authOptions.providers[0].options.name).toBe('Ethereum')
    expect(authOptions.providers[0].options.credentials).toEqual({
      message: {
        label: 'Message',
        type: 'text',
        placeholder: '0x0',
      },
      signature: {
        label: 'Signature',
        type: 'text',
        placeholder: '0x0',
      },
    })
  })

  it('should use JWT session strategy', () => {
    expect(authOptions.session!.strategy).toBe('jwt')
  })

  describe('authorize function', () => {
    const authorize = authOptions.providers[0].options.authorize

    it('should return null when credentials are missing', async () => {
      const result = await authorize({} as any, { headers: {} } as any)
      expect(result).toBeNull()
    })

    it('should handle SIWE verification failure', async () => {
      console.log('TEST: Starting SIWE verification failure test')
      const mockSiweInstance = {
        address: '0x123',
        verify: vi.fn().mockResolvedValue({ success: false, data: { nonce: 'mock-nonce', chainId: 1 } })
      }
      mockSiweMessage.mockImplementation(() => {
        console.log('mockSiweMessage implementation called')
        return mockSiweInstance
      })

      const credentials = {
        message: 'test-message',
        signature: '0xsignature'
      }
      const req = {
        headers: {}
      }

      console.log('Calling authorize...')
      const result = await authorize(credentials as any, req as any)
      console.log('authorize result:', result)
      expect(result).toBeNull()
      expect(mockSiweInstance.verify).toHaveBeenCalled()
    })

    it('should create new user when wallet is not in database', async () => {
      const mockSiweInstance = {
        address: '0x1234567890123456789012345678901234567890',
        verify: vi.fn().mockResolvedValue({
          success: true,
          data: {
            nonce: 'mock-nonce',
            chainId: 1
          }
        })
      }
      mockSiweMessage.mockImplementation(() => mockSiweInstance)

      // Mock database to return no existing user
      mockSql.execute.mockResolvedValue({ rows: [] })

      // Mock insert to return new user
      const mockInsertResult = {
        id: 1,
        nombre: mockSiweInstance.address,
        nusuario: '0x12345...67890',
        email: '0x12345...67890@localhost'
      }
      mockInsertInto.mockImplementation(() => {
        console.log('mockInsertInto called')
        return {
          values: vi.fn(() => {
            console.log('mockInsertInto.values called')
            return {
              returningAll: vi.fn(() => {
                console.log('mockInsertInto.values.returningAll called')
                return {
                  executeTakeFirstOrThrow: vi.fn().mockResolvedValue(mockInsertResult)
                }
              })
            }
          })
        }
      })

      const credentials = {
        message: 'test-message',
        signature: '0xsignature'
      }
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1'
        }
      }

      const result = await authorize(credentials as any, req as any)
      expect(result).toEqual({
        id: mockSiweInstance.address
      })
    })

    it('should update existing user when wallet is in database', async () => {
      const mockSiweInstance = {
        address: '0x1234567890123456789012345678901234567890',
        verify: vi.fn().mockResolvedValue({
          success: true,
          data: {
            nonce: 'mock-nonce',
            chainId: 1
          }
        })
      }
      mockSiweMessage.mockImplementation(() => mockSiweInstance)

      // Mock database to return existing user
      mockSql.execute.mockResolvedValue({ rows: [{ usuario_id: 1 }] })
      mockExecuteTakeFirst.mockResolvedValue({
        id: 1,
        current_sign_in_ip: '192.168.1.100',
        current_sign_in_at: new Date()
      })

      const credentials = {
        message: 'test-message',
        signature: '0xsignature'
      }
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.2'
        }
      }

      const result = await authorize(credentials as any, req as any)
      expect(result).toEqual({
        id: mockSiweInstance.address
      })
      // Should update user sign-in info
      expect(mockUpdateTable).toHaveBeenCalled()
    })

    it('should submit referral on production environment', async () => {
      const originalEnv = process.env.NEXT_PUBLIC_AUTH_URL
      process.env.NEXT_PUBLIC_AUTH_URL = 'https://learn.tg'

      const mockSiweInstance = {
        address: '0x1234567890123456789012345678901234567890',
        verify: vi.fn().mockResolvedValue({
          success: true,
          data: {
            nonce: 'mock-nonce',
            chainId: 1
          }
        })
      }
      mockSiweMessage.mockImplementation(() => mockSiweInstance)
      mockSql.execute.mockResolvedValue({ rows: [] })

      const credentials = {
        message: 'test-message',
        signature: '0xsignature'
      }
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1'
        }
      }

      await authorize(credentials as any, req as any)

      expect(mockSubmitReferral).toHaveBeenCalledWith({
        message: 'test-message',
        signature: '0xsignature',
        chainId: 1
      })

      process.env.NEXT_PUBLIC_AUTH_URL = originalEnv
    })

    it('should not submit referral on non-production environment', async () => {
      const originalEnv = process.env.NEXT_PUBLIC_AUTH_URL
      process.env.NEXT_PUBLIC_AUTH_URL = 'http://localhost:3000'

      const mockSiweInstance = {
        address: '0x1234567890123456789012345678901234567890',
        verify: vi.fn().mockResolvedValue({
          success: true,
          data: {
            nonce: 'mock-nonce',
            chainId: 1
          }
        })
      }
      mockSiweMessage.mockImplementation(() => mockSiweInstance)
      mockSql.execute.mockResolvedValue({ rows: [] })

      const credentials = {
        message: 'test-message',
        signature: '0xsignature'
      }
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1'
        }
      }

      await authorize(credentials as any, req as any)

      expect(mockSubmitReferral).not.toHaveBeenCalled()

      process.env.NEXT_PUBLIC_AUTH_URL = originalEnv
    })

    it('should handle exceptions gracefully', async () => {
      const mockSiweInstance = {
        address: '0x123',
        verify: vi.fn().mockRejectedValue(new Error('Verification failed'))
      }
      mockSiweMessage.mockImplementation(() => mockSiweInstance)

      const credentials = {
        message: 'test-message',
        signature: '0xsignature'
      }
      const req = {
        headers: {}
      }

      const result = await authorize(credentials as any, req as any)
      expect(result).toBeNull()
    })
  })

  describe('session callback', () => {
    const sessionCallback = authOptions.callbacks?.session

    it('should add address to session from token', async () => {
      const session = { user: {} }
      const token = { sub: '0x1234567890123456789012345678901234567890' }

      const result = await sessionCallback!({ session, token } as any)
      expect((result as any).address).toBe(token.sub)
      expect((result as any).user.name).toBe(token.sub)
    })

    it('should handle token without sub', async () => {
      const session = { user: {} }
      const token = { sub: null }

      const result = await sessionCallback!({ session, token } as any)
      expect((result as any).address).toBeUndefined()
    })

    it('should preserve existing session user', async () => {
      const session = { user: { name: 'Existing', email: 'test@example.com' } }
      const token = { sub: '0x1234567890123456789012345678901234567890' }

      const result = await sessionCallback!({ session, token } as any)
      expect((result as any).address).toBe(token.sub)
      expect((result as any).user.name).toBe(token.sub)
      expect((result as any).user.email).toBe('test@example.com')
    })
  })
})