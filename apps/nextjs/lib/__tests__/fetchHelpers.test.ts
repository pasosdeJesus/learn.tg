import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildParamsWithSession, createFetchFunction } from '../fetchHelpers'
import type { Session } from 'next-auth'

describe('fetchHelpers', () => {
  describe('buildParamsWithSession', () => {
    it('should return empty URLSearchParams when no session and no base params', () => {
      const result = buildParamsWithSession(null)
      expect(result.toString()).toBe('')
    })

    it('should include base params when provided', () => {
      const baseParams = { sortBy: 'learningpoints', page: '1' }
      const result = buildParamsWithSession(null, baseParams)
      expect(result.get('sortBy')).toBe('learningpoints')
      expect(result.get('page')).toBe('1')
    })

    it('should include wallet from session when address exists', () => {
      const session: Session = { address: '0x123', expires: '2026-01-01', user: { name: 'Test' } } as any
      const result = buildParamsWithSession(session)
      expect(result.get('wallet')).toBe('0x123')
    })

    it('should include token from session.user.token when available', () => {
      const session: Session = {
        address: '0x123',
        expires: '2026-01-01',
        user: { name: 'Test', token: 'user-token' }
      } as any
      const result = buildParamsWithSession(session)
      expect(result.get('wallet')).toBe('0x123')
      expect(result.get('token')).toBe('user-token')
    })

    it('should include token from session.token when available (fallback)', () => {
      const session: Session = {
        address: '0x123',
        expires: '2026-01-01',
        token: 'session-token'
      } as any
      const result = buildParamsWithSession(session)
      expect(result.get('wallet')).toBe('0x123')
      expect(result.get('token')).toBe('session-token')
    })

    it('should combine base params and session params', () => {
      const session: Session = {
        address: '0x123',
        expires: '2026-01-01',
        user: { name: 'Test', token: 'test-token' }
      } as any
      const baseParams = { sortBy: 'learningpoints', page: '1' }
      const result = buildParamsWithSession(session, baseParams)

      expect(result.get('sortBy')).toBe('learningpoints')
      expect(result.get('page')).toBe('1')
      expect(result.get('wallet')).toBe('0x123')
      expect(result.get('token')).toBe('test-token')
    })

    it('should handle session without address', () => {
      const session: Session = { expires: '2026-01-01', user: { name: 'Test' } } as any
      const result = buildParamsWithSession(session)
      expect(result.get('wallet')).toBeNull()
      expect(result.get('token')).toBeNull()
    })

    it('should handle session with address but no token', () => {
      const session: Session = {
        address: '0x123',
        expires: '2026-01-01',
        user: { name: 'Test' }
      } as any
      const result = buildParamsWithSession(session)
      expect(result.get('wallet')).toBe('0x123')
      expect(result.get('token')).toBeNull()
    })
  })

  describe('createFetchFunction', () => {
    let mockFetch: any

    beforeEach(() => {
      mockFetch = vi.fn()
      global.fetch = mockFetch
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should create a function that fetches from correct endpoint', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const fetchFunction = createFetchFunction<{ data: string }>('leaderboard')
      const session: Session = { address: '0x123', expires: '2026-01-01' } as any

      const result = await fetchFunction(session)

      expect(mockFetch).toHaveBeenCalledWith('/api/leaderboard?wallet=0x123')
      expect(result).toEqual({ data: 'test' })
    })

    it('should include params from buildParams function', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const buildParams = vi.fn().mockReturnValue({ sortBy: 'learningpoints', page: '1' })
      const fetchFunction = createFetchFunction<{ data: string }>('leaderboard', buildParams)
      const session: Session = { address: '0x123', expires: '2026-01-01' } as any

      await fetchFunction(session)

      expect(buildParams).toHaveBeenCalledWith(session)
      expect(mockFetch).toHaveBeenCalledWith('/api/leaderboard?sortBy=learningpoints&page=1&wallet=0x123')
    })

    it('should throw error when response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      }
      mockFetch.mockResolvedValue(mockResponse)

      const fetchFunction = createFetchFunction<{ data: string }>('leaderboard')
      const session: Session = { address: '0x123', expires: '2026-01-01' } as any

      await expect(fetchFunction(session)).rejects.toThrow('HTTP error! status: 500')
    })

    it('should work with null session', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const fetchFunction = createFetchFunction<{ data: string }>('transparency')

      const result = await fetchFunction(null)

      expect(mockFetch).toHaveBeenCalledWith('/api/transparency?')
      expect(result).toEqual({ data: 'test' })
    })

    it('should combine session params with buildParams function params', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const buildParams = vi.fn().mockReturnValue({ country: 'CO' })
      const fetchFunction = createFetchFunction<{ data: string }>('leaderboard', buildParams)
      const session: Session = {
        address: '0x123',
        expires: '2026-01-01',
        user: { name: 'Test', token: 'test-token' }
      } as any

      await fetchFunction(session)

      expect(mockFetch).toHaveBeenCalledWith('/api/leaderboard?country=CO&wallet=0x123&token=test-token')
    })
  })
})