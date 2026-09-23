import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { apiAuthMocks } from '@pasosdejesus/m/test-utils/rainbowkit-mocks'

// Use auth-mocks for authentication and API mocking
const { mocks } = apiAuthMocks
const useSessionMock = mocks.mockUseSession
const getCsrfTokenMock = mocks.mockGetCsrfToken
const axiosGetMock = mocks.mockAxiosGet

// Setup mocks before importing the hook
apiAuthMocks.setupMocks()

// Mock useAuthAddress (replaces wagmi's useAccount after R-#186)
vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: vi.fn()
}))
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

const offlineCourseMocks = vi.hoisted(() => ({ getDownloadedCourse: vi.fn() }))
vi.mock('@/lib/offline-course-db', () => ({
  courseKey: (lang: string, prefix: string) => `${lang}/${String(prefix).split('/').filter(Boolean).join('/')}`,
  getDownloadedCourse: offlineCourseMocks.getDownloadedCourse,
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
    amountScholarship: 1000000,
    amountPerGuide: 500000,
    isEligible: true,
    percentageCompleted: 50,
    vaultCreated: null,
    vaultBalance: null,
    canSubmit: null,
    completedGuides: null,
    paidGuides: null,
    totalGuides: null,
    percentagePaid: null,
    profileScore: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiAuthMocks.resetMocks()
    apiAuthMocks.setupDefaultImplementations()

    // Default mocks
    useSessionMock.mockReturnValue({ data: mockSession, status: 'authenticated' })
    vi.mocked(useAuthAddress).mockReturnValue({ address: '0x123', sessionAddress: '0x123', storedAddress: '0x123', inAppAddress: undefined, isInAppUnlocked: false, isAuthenticated: true, isSessionLoading: false, isWalletAvailable: true, isWalletCheckComplete: true })
    getCsrfTokenMock.mockResolvedValue('mock-csrf-token')
    offlineCourseMocks.getDownloadedCourse.mockResolvedValue(null)

    // Default axios.get implementation
    axiosGetMock.mockImplementation((url: string) => {
      if (url.includes('/api/scholarship')) {
        return Promise.resolve({ data: mockScholarshipData })
      }
      if (url.includes('/api/guide-status')) {
        return Promise.resolve({ data: { completed: false, receivedScholarship: false } })
      }
      if (url.startsWith('/api/course-catalog/')) {
        return Promise.resolve({ data: mockCourse })
      }
      // Default: course list
      return Promise.resolve({ data: [mockCourse] })
    })

  })

  it('should return loading state initially', () => {
    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.course).toBe(null)
    expect(result.current.error).toBe(null)
  })

  it('should fetch course and scholarship data successfully', async () => {
    axiosGetMock.mockImplementation((url: string) => {
      if (url.includes('/api/guide-status')) {
        if (url.includes('guideNumber=1')) {
            return Promise.resolve({ data: { completed: true, receivedScholarship: false } })
        }
        return Promise.resolve({ data: { completed: false, receivedScholarship: false } })
      }
       if (url.includes('/api/scholarship')) {
        return Promise.resolve({ data: mockScholarshipData })
      }
      if (url.startsWith('/api/course-catalog/')) {
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
  })

  it('should handle session/address mismatch (early return)', async () => {
    // Session address different from wallet address (useAuthAddress)
    useSessionMock.mockReturnValue({
      data: { ...mockSession, address: '0xAAA' },
      status: 'authenticated'
    })
    vi.mocked(useAuthAddress).mockReturnValue({ address: '0xBBB', sessionAddress: undefined, storedAddress: '0xBBB', inAppAddress: undefined, isInAppUnlocked: false, isAuthenticated: true, isSessionLoading: false, isWalletAvailable: true, isWalletCheckComplete: true })

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
    vi.mocked(useAuthAddress).mockReturnValue({ address: undefined, sessionAddress: undefined, storedAddress: undefined, inAppAddress: undefined, isInAppUnlocked: false, isAuthenticated: false, isSessionLoading: false, isWalletAvailable: false, isWalletCheckComplete: false })

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

  it('should handle a 404 from the course detail endpoint', async () => {
    const notFound: any = new Error('Request failed with status code 404')
    notFound.response = { status: 404 }
    axiosGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/course-catalog/')) return Promise.reject(notFound)
      return Promise.resolve({ data: [mockCourse] })
    })

    const { result } = renderHook(() =>
      useGuideData({ lang: 'en', pathPrefix: 'test' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.course).toBe(null)
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
      if (url.startsWith('/api/course-catalog/')) {
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
      if (url.startsWith('/api/course-catalog/')) {
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
    vi.mocked(useAuthAddress).mockReturnValue({ address: undefined, sessionAddress: undefined, storedAddress: undefined, inAppAddress: undefined, isInAppUnlocked: false, isAuthenticated: false, isSessionLoading: false, isWalletAvailable: false, isWalletCheckComplete: false })

    let guideStatusCalled = false
    axiosGetMock.mockImplementation((url: string) => {
      if (url.includes('/api/guide-status')) {
        guideStatusCalled = true
        return Promise.resolve({ data: { completed: true, receivedScholarship: false } })
      }
      if (url.startsWith('/api/course-catalog/')) {
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

  // R-#256 §3.7: sin conexión el catálogo no responde; si el curso está descargado,
  // la página del curso (y la de sus guías) se arma con el registro guardado.
  it('falls back to the downloaded course when the catalog fails', async () => {
    axiosGetMock.mockRejectedValue(new Error('Network error'))
    offlineCourseMocks.getDownloadedCourse.mockResolvedValue({
      key: 'en/test',
      courseId: 105,
      lang: 'en',
      prefix: 'test',
      titulo: 'Curso descargado',
      contenidoCristiano: false,
      isPremium: false,
      wallet: '0x123',
      downloadedAt: Date.now(),
      revision: 'x',
      guides: [{ suffix: 'guide1', puzzle: null }, { suffix: 'guide2', puzzle: null }],
      bytes: 10,
    })

    const { result } = renderHook(() => useGuideData({ lang: 'en', pathPrefix: 'test' }))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe(null)
    expect(result.current.course?.titulo).toBe('Curso descargado')
    expect(result.current.course?.guias.map((guide) => guide.sufijoRuta)).toEqual(['guide1', 'guide2'])
  })

  it('reports the error when the catalog fails and the course was never downloaded', async () => {
    axiosGetMock.mockRejectedValue(new Error('Network error'))
    offlineCourseMocks.getDownloadedCourse.mockResolvedValue(null)

    const { result } = renderHook(() => useGuideData({ lang: 'en', pathPrefix: 'test' }))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.course).toBe(null)
    expect(result.current.error).toBeTruthy()
  })
})
