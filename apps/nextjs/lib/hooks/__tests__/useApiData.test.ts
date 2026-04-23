import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'

// Mock modules
vi.mock('next-auth/react', () => ({
  useSession: vi.fn()
}))

vi.mock('../../fetchHelpers', () => ({
  buildParamsWithSession: vi.fn()
}))

vi.mock('../useFetchData', () => ({
  useFetchData: vi.fn()
}))

import { useApiData } from '../useApiData'
import { buildParamsWithSession } from '../../fetchHelpers'
import { useFetchData } from '../useFetchData'

describe('useApiData', () => {
  const mockSession = {
    address: '0x123',
    expires: '2026-01-01',
    user: { name: 'Test User' }
  }

  let mockFetch: any
  let mockUseFetchDataReturn: any

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSession as any).mockReturnValue({ data: mockSession })

    // Mock fetch globally
    mockFetch = vi.fn()
    global.fetch = mockFetch

    // Mock buildParamsWithSession
    ;(buildParamsWithSession as any).mockReturnValue(new URLSearchParams(''))

    // Mock useFetchData return value
    mockUseFetchDataReturn = {
      data: undefined,
      isLoading: false,
      error: null,
      fetchData: vi.fn(),
      setData: vi.fn()
    }
    ;(useFetchData as any).mockReturnValue(mockUseFetchDataReturn)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchFunction creation', () => {
    it('should create a fetchFunction that calls correct endpoint', async () => {
      // We'll test the actual fetchFunction by spying on useFetchData
      let capturedFetchFunction: any
      ;(useFetchData as any).mockImplementation((options: any) => {
        capturedFetchFunction = options.fetchFunction
        return mockUseFetchDataReturn
      })

      renderHook(() =>
        useApiData({
          endpoint: 'leaderboard',
          params: { sortBy: 'learningpoints' }
        })
      )

      expect(capturedFetchFunction).toBeDefined()

      // Test the fetchFunction directly
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' })
      }
      mockFetch.mockResolvedValue(mockResponse)
      ;(buildParamsWithSession as any).mockReturnValue(new URLSearchParams('sortBy=learningpoints&wallet=0x123'))

      const result = await capturedFetchFunction(mockSession, {})

      expect(buildParamsWithSession).toHaveBeenCalledWith(mockSession, {
        sortBy: 'learningpoints'
      })
      expect(mockFetch).toHaveBeenCalledWith('/api/leaderboard?sortBy=learningpoints&wallet=0x123')
      expect(result).toEqual({ data: 'test' })
    })

    it('should merge params correctly', async () => {
      let capturedFetchFunction: any
      ;(useFetchData as any).mockImplementation((options: any) => {
        capturedFetchFunction = options.fetchFunction
        return mockUseFetchDataReturn
      })

      renderHook(() =>
        useApiData({
          endpoint: 'leaderboard',
          params: { sortBy: 'learningpoints' }
        })
      )

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      // Call with custom params
      ;(buildParamsWithSession as any).mockReturnValue(new URLSearchParams('sortBy=learningpoints&page=2&wallet=0x123'))
      await capturedFetchFunction(mockSession, { page: '2' })

      expect(buildParamsWithSession).toHaveBeenCalledWith(mockSession, {
        sortBy: 'learningpoints',
        page: '2'
      })
    })

    it('should throw error when fetch response is not ok', async () => {
      let capturedFetchFunction: any
      ;(useFetchData as any).mockImplementation((options: any) => {
        capturedFetchFunction = options.fetchFunction
        return mockUseFetchDataReturn
      })

      renderHook(() => useApiData({ endpoint: 'leaderboard' }))

      const mockResponse = {
        ok: false,
        status: 500
      }
      mockFetch.mockResolvedValue(mockResponse)

      await expect(capturedFetchFunction(mockSession, {})).rejects.toThrow('HTTP error! status: 500')
    })

    it('should work with null session', async () => {
      let capturedFetchFunction: any
      ;(useFetchData as any).mockImplementation((options: any) => {
        capturedFetchFunction = options.fetchFunction
        return mockUseFetchDataReturn
      })

      renderHook(() => useApiData({ endpoint: 'transparency' }))

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' })
      }
      mockFetch.mockResolvedValue(mockResponse)
      ;(buildParamsWithSession as any).mockReturnValue(new URLSearchParams(''))

      await capturedFetchFunction(null, {})

      expect(buildParamsWithSession).toHaveBeenCalledWith(null, {})
      expect(mockFetch).toHaveBeenCalledWith('/api/transparency?')
    })
  })

  describe('integration with useFetchData', () => {
    it('should pass correct options to useFetchData', () => {
      const endpoint = 'leaderboard'
      const params = { sortBy: 'learningpoints', page: '1' }
      const initialData = { data: [] }
      const autoFetch = false

      renderHook(() =>
        useApiData({
          endpoint,
          params,
          initialData,
          autoFetch
        })
      )

      expect(useFetchData).toHaveBeenCalledWith({
        initialData,
        fetchFunction: expect.any(Function),
        params,
        autoFetch
      })
    })

    it('should return values from useFetchData', () => {
      const mockReturn = {
        data: { test: 'data' },
        isLoading: true,
        error: new Error('test'),
        fetchData: vi.fn(),
        setData: vi.fn()
      }
      ;(useFetchData as any).mockReturnValue(mockReturn)

      const { result } = renderHook(() => useApiData({ endpoint: 'leaderboard' }))

      expect(result.current.data).toEqual(mockReturn.data)
      expect(result.current.isLoading).toBe(mockReturn.isLoading)
      expect(result.current.error).toBe(mockReturn.error)
      expect(result.current.fetchData).toBe(mockReturn.fetchData)
      expect(result.current.setData).toBe(mockReturn.setData)
    })
  })

  describe('actual integration test (without mocking useFetchData)', () => {
    // This test doesn't mock useFetchData to test the full integration
    afterEach(() => {
      // Restore the mock for other tests
      vi.doMock('./useFetchData', () => ({ useFetchData: vi.fn() }))
    })

    it.skip('should fetch data from API successfully', async () => {
      // Don't mock useFetchData for this test
      vi.doUnmock('./useFetchData')

      const mockResponseData = { data: [{ id: 1, name: 'Test' }], pagination: { page: 1, total: 1 } }
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponseData)
      }
      // Make fetch resolve after a microtask to allow isLoading to be true
      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockResponse), 0))
      )
      ;(buildParamsWithSession as any).mockReturnValue(new URLSearchParams('wallet=0x123'))

      const { result } = renderHook(() =>
        useApiData({
          endpoint: 'leaderboard',
          autoFetch: true
        })
      )

      // Should be loading initially (autoFetch is true)
      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockResponseData)
      expect(result.current.error).toBe(null)
      expect(mockFetch).toHaveBeenCalledWith('/api/leaderboard?wallet=0x123')
    })

    it.skip('should handle API errors', async () => {
      vi.doUnmock('./useFetchData')

      const mockResponse = {
        ok: false,
        status: 500
      }
      // Make fetch resolve after a microtask to allow isLoading to be true
      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockResponse), 0))
      )
      ;(buildParamsWithSession as any).mockReturnValue(new URLSearchParams(''))

      const { result } = renderHook(() =>
        useApiData({
          endpoint: 'leaderboard',
          autoFetch: true
        })
      )

      // isLoading should be true initially
      expect(result.current.isLoading).toBe(true)

      // Wait for error to be set (isLoading will become false)
      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error)
      })

      expect(result.current.error?.message).toBe('HTTP error! status: 500')
      expect(result.current.data).toBeUndefined()
      expect(result.current.isLoading).toBe(false)
      expect(mockFetch).toHaveBeenCalledWith('/api/leaderboard?')
    })
  })
})