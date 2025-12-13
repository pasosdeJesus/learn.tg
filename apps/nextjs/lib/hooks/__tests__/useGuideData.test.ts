import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Define mocks before importing the hook
const useSessionMock = vi.fn()
const getCsrfTokenMock = vi.fn()
const useAccountMock = vi.fn()
const axiosGetMock = vi.fn()

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
  getCsrfToken: () => getCsrfTokenMock(),
}))

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: () => useAccountMock(),
}))

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: (...args: any[]) => axiosGetMock(...args),
  },
}))

// Import hook after mocks
import { useGuideData } from '../useGuideData'

describe('useGuideData', () => {
  const mockSession = {
    address: '0x123',
    user: { name: 'Test User' }
  }

  const mockCourse = {
    id: 'course-1',
    titulo: 'Test Course',
    subtitulo: 'Test Subtitle',
    idioma: 'en',
    prefijoRuta: '/test',
    guias: [
      { titulo: 'Guide 1', sufijoRuta: 'guide1' },
      { titulo: 'Guide 2', sufijoRuta: 'guide2' }
    ],
    conBilletera: true,
    sinBilletera: false,
    creditosMd: '# Credits',
    resumenMd: '# Summary',
    ampliaMd: '# Extended',
    imagen: '/test.jpg',
    altImagen: 'Test image',
    enlaceImagen: 'https://example.com',
    creditoImagen: 'Credit'
  }

  const mockScholarshipData = {
    percentageCompleted: '75.5'
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks
    useSessionMock.mockReturnValue({ data: mockSession, status: 'authenticated' })
    useAccountMock.mockReturnValue({ address: '0x123', isConnected: true })
    getCsrfTokenMock.mockResolvedValue('mock-csrf-token')

    // Default axios.get implementation
    axiosGetMock.mockImplementation((url: string) => {
      if (url.includes('/api/scholarship')) {
        return Promise.resolve({ data: mockScholarshipData })
      }
      if (url.includes('/api/guide-status')) {
        return Promise.resolve({ data: { completed: false, receivedScholarship: false } })
      }
      if (url.includes('presenta')) {
        return Promise.resolve({ data: mockCourse })
      }
      // Default: course list
      return Promise.resolve({ data: [mockCourse] })
    })

    // Set environment variables
    process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL = 'https://fake.local/courses'
    process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL = 'https://fake.local/presenta'
  })

  it('should return loading state initially', () => {
    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.course).toBe(null)
    expect(result.current.error).toBe(null)
  })

  it('should fetch course data successfully', async () => {
    axiosGetMock.mockImplementation((url: string) => {
      if (url.includes('/api/guide-status')) {
        // Mock first guide as completed
        if (url.includes('guideNumber=1')) {
            return Promise.resolve({ data: { completed: true, receivedScholarship: false } })
        }
        return Promise.resolve({ data: { completed: false, receivedScholarship: false } })
      }
      if (url.includes('presenta')) {
        return Promise.resolve({ data: mockCourse })
      }
      return Promise.resolve({ data: [mockCourse] })
    })

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.course).toBeTruthy()
    expect(result.current.course?.id).toBe('course-1')
    expect(result.current.error).toBe(null)
    expect(result.current.percentageCompleted).toBe(50)
  })

  it('should handle session/address mismatch (early return)', async () => {
    // Session address different from wallet address
    useSessionMock.mockReturnValue({
      data: { ...mockSession, address: '0xAAA' },
      status: 'authenticated'
    })
    useAccountMock.mockReturnValue({ address: '0xBBB', isConnected: true })

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    // Should stay in loading state because early return prevents fetching
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // No course data fetched
    expect(result.current.course).toBe(null)
    expect(result.current.error).toBe(null)
  })

  it('should fetch course data without session (public access)', async () => {
    useSessionMock.mockReturnValue({
      data: null,
      status: 'unauthenticated'
    })
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false })

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Should still load course data without user-specific info
    expect(result.current.course).toBeTruthy()
    expect(result.current.course?.id).toBe('course-1')
    expect(result.current.error).toBe(null)
    expect(result.current.percentageCompleted).toBe(null) // No scholarship data without session
  })

  it('should handle course not found error', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: [] }) // Empty course list

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Course not found')
    expect(result.current.course).toBe(null)
  })

  it('should handle missing API URL environment variable', async () => {
    delete process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('API presentation URL is not defined')
  })

  it('should handle axios network error', async () => {
    axiosGetMock.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Network error')
  })

  it('should handle scholarship API error gracefully', async () => {
    // Mock successful course fetch but failing scholarship API
    axiosGetMock.mockImplementation((url: string) => {
      if (url.includes('/api/scholarship')) {
        return Promise.reject(new Error('Scholarship API down'))
      }
      if (url.includes('presenta')) {
        return Promise.resolve({ data: mockCourse })
      }
      return Promise.resolve({ data: [mockCourse] })
    })

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Should still have course data despite scholarship error
    expect(result.current.course).toBeTruthy()
    expect(result.current.error).toBe(null)
    expect(result.current.percentageCompleted).toBe(null)
  })

  it('should calculate guide navigation paths when pathSuffix provided', async () => {
    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test', pathSuffix: 'guide1' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.myGuide).toBeTruthy()
    expect(result.current.myGuide?.titulo).toBe('Guide 1')
    expect(result.current.guideNumber).toBe(1)
    expect(result.current.nextGuidePath).toBe('/en/test/guide2')
    expect(result.current.previousGuidePath).toBe('')
    expect(result.current.coursePath).toBe('/en/test')
  })

  it('should handle guide not found when pathSuffix does not match', async () => {
    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test', pathSuffix: 'nonexistent' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.myGuide).toBe(null)
    expect(result.current.guideNumber).toBe(0)
    expect(result.current.nextGuidePath).toBe('')
    expect(result.current.previousGuidePath).toBe('')
  })

  it('should fetch guide status for each guide when session exists', async () => {
    // Mock guide-status API to return different values
    let guideStatusCallCount = 0
    axiosGetMock.mockImplementation((url: string) => {
      if (url.includes('/api/guide-status')) {
        guideStatusCallCount++
        return Promise.resolve({
          data: { completed: guideStatusCallCount === 1, receivedScholarship: false }
        })
      }
      if (url.includes('presenta')) {
        return Promise.resolve({ data: mockCourse })
      }
      return Promise.resolve({ data: [mockCourse] })
    })

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.course?.guias[0].completed).toBe(true)
    expect(result.current.course?.guias[1].completed).toBe(false)
  })

  it('should not fetch guide status when no session', async () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' })
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false })

    let guideStatusCalled = false
    axiosGetMock.mockImplementation((url: string) => {
      if (url.includes('/api/guide-status')) {
        guideStatusCalled = true
        return Promise.resolve({ data: { completed: true, receivedScholarship: false } })
      }
      if (url.includes('presenta')) {
        return Promise.resolve({ data: mockCourse })
      }
      return Promise.resolve({ data: [mockCourse] })
    })

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(guideStatusCalled).toBe(false)
    expect(result.current.course?.guias[0].completed).toBe(false)
    expect(result.current.course?.guias[1].completed).toBe(false)
  })
})

