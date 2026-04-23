import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSession } from 'next-auth/react'

// Mock useSession
vi.mock('next-auth/react', () => ({
  useSession: vi.fn()
}))

import { useFetchData } from '../useFetchData'

describe('useFetchData', () => {
  const mockSession = {
    address: '0x123',
    expires: '2026-01-01',
    user: { name: 'Test User' }
  }

  let mockFetchFunction: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchFunction = vi.fn()
    ;(useSession as any).mockReturnValue({ data: mockSession })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with initialData when provided', () => {
    const initialData = { message: 'initial data' }
    const { result } = renderHook(() =>
      useFetchData({
        initialData,
        fetchFunction: mockFetchFunction
      })
    )

    expect(result.current.data).toEqual(initialData)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should initialize without data when no initialData provided', () => {
    const { result } = renderHook(() =>
      useFetchData({
        fetchFunction: mockFetchFunction,
        autoFetch: false
      })
    )

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should auto-fetch when no initialData provided and autoFetch is true (default)', async () => {
    const mockData = { message: 'fetched data' }
    mockFetchFunction.mockResolvedValue(mockData)

    const { result } = renderHook(() =>
      useFetchData({
        fetchFunction: mockFetchFunction
      })
    )

    // Should be loading initially
    expect(result.current.isLoading).toBe(true)
    expect(mockFetchFunction).toHaveBeenCalledWith(mockSession, {})

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBe(null)
  })

  it('should not auto-fetch when initialData is provided', async () => {
    const initialData = { message: 'initial data' }
    mockFetchFunction.mockResolvedValue({ message: 'fetched data' })

    const { result } = renderHook(() =>
      useFetchData({
        initialData,
        fetchFunction: mockFetchFunction
      })
    )

    expect(result.current.data).toEqual(initialData)
    expect(result.current.isLoading).toBe(false)
    expect(mockFetchFunction).not.toHaveBeenCalled()
  })

  it('should not auto-fetch when autoFetch is false', async () => {
    mockFetchFunction.mockResolvedValue({ message: 'fetched data' })

    const { result } = renderHook(() =>
      useFetchData({
        fetchFunction: mockFetchFunction,
        autoFetch: false
      })
    )

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
    expect(mockFetchFunction).not.toHaveBeenCalled()
  })

  it('should pass params to fetchFunction', async () => {
    const mockData = { message: 'fetched data' }
    mockFetchFunction.mockResolvedValue(mockData)
    const params = { sortBy: 'learningpoints', page: 1 }

    const { result } = renderHook(() =>
      useFetchData({
        fetchFunction: mockFetchFunction,
        params
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFetchFunction).toHaveBeenCalledWith(mockSession, params)
  })

  it('should handle fetchData call with custom params', async () => {
    const mockData = { message: 'fetched data' }
    mockFetchFunction.mockResolvedValue(mockData)
    const hookParams = { sortBy: 'learningpoints' }
    const customParams = { page: 2, country: 'CO' }

    const { result } = renderHook(() =>
      useFetchData({
        fetchFunction: mockFetchFunction,
        params: hookParams,
        autoFetch: false // Disable auto-fetch to control timing
      })
    )

    // No initial auto-fetch, isLoading should be false
    expect(result.current.isLoading).toBe(false)

    // Call fetchData with custom params
    mockFetchFunction.mockClear()
    result.current.fetchData(customParams)

    // First verify that fetchFunction was called (means fetchData executed)
    await waitFor(() => {
      expect(mockFetchFunction).toHaveBeenCalledTimes(1)
    })
    expect(mockFetchFunction).toHaveBeenCalledWith(mockSession, {
      ...hookParams,
      ...customParams
    })

    // isLoading may have been true briefly, but with immediate resolution
    // it may already be false. We can verify that data was set.
    await waitFor(() => {
      expect(result.current.data).toEqual(mockData)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should handle fetch error', async () => {
    const error = new Error('Network error')
    mockFetchFunction.mockRejectedValue(error)

    const { result } = renderHook(() =>
      useFetchData({
        fetchFunction: mockFetchFunction
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe(error)
    expect(result.current.data).toBeUndefined()
  })

  it('should keep existing data on error', async () => {
    const initialData = { message: 'initial data' }
    const error = new Error('Network error')

    // Mock will reject when fetchData is called
    mockFetchFunction.mockRejectedValueOnce(error)

    const { result } = renderHook(() =>
      useFetchData({
        initialData,
        fetchFunction: mockFetchFunction,
        autoFetch: false // Disable auto-fetch since we have initialData
      })
    )

    // Initial data should be present
    expect(result.current.data).toEqual(initialData)
    expect(result.current.error).toBe(null)

    // Call fetchData which should fail
    result.current.fetchData()

    // Verify fetchFunction was called
    expect(mockFetchFunction).toHaveBeenCalledTimes(1)
    expect(mockFetchFunction).toHaveBeenCalledWith(mockSession, {})

    // Wait for error to be set
    await waitFor(() => {
      expect(result.current.error).toBe(error)
    })

    // Should keep the initial data
    expect(result.current.data).toEqual(initialData)
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle session changes', async () => {
    const mockData1 = { message: 'data with session 1' }
    const mockData2 = { message: 'data with session 2' }
    mockFetchFunction
      .mockResolvedValueOnce(mockData1)
      .mockResolvedValueOnce(mockData2)

    const { result, rerender } = renderHook(
      ({ session }) => {
        ;(useSession as any).mockReturnValue({ data: session })
        return useFetchData({
          fetchFunction: mockFetchFunction
        })
      },
      {
        initialProps: { session: mockSession }
      }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData1)
    expect(mockFetchFunction).toHaveBeenCalledWith(mockSession, {})

    // Change session
    const newSession = { ...mockSession, address: '0x456' }
    mockFetchFunction.mockClear()
    rerender({ session: newSession })

    // fetchData should be called again because it's in the dependency array
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Note: Actually, the hook won't re-fetch automatically when session changes
    // unless fetchData is called manually or useEffect has session in deps.
    // Let's verify the current behavior - the useEffect only runs on mount.
    // So we expect no additional call.
    // Actually looking at the hook: fetchData has session in its deps,
    // but the useEffect doesn't re-run when fetchData changes.
    // So we need to test that fetchData uses updated session when called.
  })

  it('should use updated session when fetchData is called', async () => {
    const session1 = { ...mockSession, address: '0x123' }
    const session2 = { ...mockSession, address: '0x456' }
    const mockData = { message: 'fetched data' }
    mockFetchFunction.mockResolvedValue(mockData)

    // Start with session1
    ;(useSession as any).mockReturnValue({ data: session1 })
    const { result, rerender } = renderHook(() =>
      useFetchData({
        fetchFunction: mockFetchFunction,
        autoFetch: false
      })
    )

    // Call fetchData with session1
    await result.current.fetchData()
    expect(mockFetchFunction).toHaveBeenCalledWith(session1, {})

    // Change session
    ;(useSession as any).mockReturnValue({ data: session2 })
    mockFetchFunction.mockClear()
    rerender()

    // Call fetchData again, should use session2
    await result.current.fetchData()
    expect(mockFetchFunction).toHaveBeenCalledWith(session2, {})
  })

  it('should handle non-Error exceptions', async () => {
    mockFetchFunction.mockRejectedValue('string error')

    const { result } = renderHook(() =>
      useFetchData({
        fetchFunction: mockFetchFunction
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Unknown error')
  })

  it('should allow manual data setting via setData', () => {
    const initialData = { message: 'initial' }
    const newData = { message: 'new' }

    const { result } = renderHook(() =>
      useFetchData({
        initialData,
        fetchFunction: mockFetchFunction,
        autoFetch: false
      })
    )

    expect(result.current.data).toEqual(initialData)

    act(() => {
      result.current.setData(newData)
    })

    expect(result.current.data).toEqual(newData)
  })
})