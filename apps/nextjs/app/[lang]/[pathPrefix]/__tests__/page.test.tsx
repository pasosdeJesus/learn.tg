import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page'
import React, { Suspense } from 'react'
import { useGuideData, type Course } from '@/lib/hooks/useGuideData'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/en/gooddollar',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ 
    lang: 'en',
    pathPrefix: 'course-prefix',
  }),
}))

// Mock axios
interface AxiosGetReturn { data: unknown }
const axiosGet = vi.fn<[url: string, ...rest: unknown[]], Promise<AxiosGetReturn>>(
  (url: string, ..._rest: unknown[]): Promise<AxiosGetReturn> => Promise.resolve({ data: [] }),
)
vi.mock('axios', () => ({
  default: { get: (url: string, ...rest: unknown[]) => axiosGet(url, ...rest) },
}))

// Mock next-auth/react
interface SessionLike {
  address: string
  user: { name: string }
}
const useSessionMock = vi.fn((): { data: SessionLike | null; status: string } => ({
  data: { address: '0x123', user: { name: 'Test User' } },
  status: 'authenticated',
}))
const getCsrfTokenMock = vi.fn(() => Promise.resolve('mock-csrf-token'))
vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
  getCsrfToken: () => getCsrfTokenMock(),
}))

// Mock wagmi
const useAccountMock = vi.fn((): { address: string | undefined; isConnected: boolean } => ({
  address: '0x123',
  isConnected: true,
}))
const usePublicClientMock = vi.fn(() => ({
  readContract: vi.fn().mockResolvedValue(0n),
  getBalance: vi.fn().mockResolvedValue(0n),
  getGasPrice: vi.fn().mockResolvedValue(1n),
  estimateContractGas: vi.fn().mockResolvedValue(21000n),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
}))
const useWalletClientMock = vi.fn(() => ({
  data: { writeContract: vi.fn().mockResolvedValue('0xhash') },
}))
vi.mock('wagmi', () => ({
  useAccount: () => useAccountMock(),
  usePublicClient: () => usePublicClientMock(),
  useWalletClient: () => useWalletClientMock(),
}))

// Mock remark plugins (unified)
vi.mock('unified', () => ({
  unified: () => ({
    use: vi.fn().mockReturnThis(),
    processSync: vi.fn().mockReturnValue({ toString: () => '<p>Mock HTML</p>' }),
  }),
}))

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ComponentPropsWithoutRef<'button'>) => (
    <button {...props}>{children}</button>
  ),
}))

// Render with Suspense
function renderWithProviders(ui: React.ReactElement) {
  return render(<Suspense fallback={<div>Loading...</div>}>{ui}</Suspense>)
}

describe('Course List Page Component', () => {
  const defaultProps = {
    params: Promise.resolve({
      lang: 'en',
      pathPrefix: 'gooddollar',
    }),
  }

  const mockCourse = {
    id: 'course-1',
    idioma: 'en',
    prefijoRuta: '/gooddollar',
    titulo: 'GoodDollar Course',
    subtitulo: 'Learn about GoodDollar',
    imagen: '/image.jpg',
    creditoImagen: 'Credit',
    enlaceImagen: 'https://example.com',
    altImagen: 'Alt',
    resumenMd: '# Summary',
    ampliaMd: '# Extended',
    prerequisitosMd: '# Prerequisites',
    cursosPrerequisito: '',
    guias: [
      {
        titulo: 'Guide 1',
        sufijoRuta: 'guide1',
      },
      {
        titulo: 'Guide 2',
        sufijoRuta: 'guide2',
      }
    ]
  }

  const API_BUSCA_URL = 'https://fake.local/courses'
  const API_PRESENTA_URL = 'https://fake.local/presenta'

  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default mocks
    useSessionMock.mockReturnValue({
      data: { address: '0x123', user: { name: 'Test User' } } as any,
      status: 'authenticated',
    })
    useAccountMock.mockReturnValue({ address: '0x123', isConnected: true })
    axiosGet.mockReset()
    // Mock alert to avoid jsdom errors
    global.window.alert = vi.fn()
    // Mock environment variables
    process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL = API_BUSCA_URL
    process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL = API_PRESENTA_URL
  })

  it('no carga datos cuando dirección y sesión difieren (partial login)', async () => {
    useSessionMock.mockReturnValue({
      data: { address: '0xAAA', user: { name: 'Test User' } } as any,
      status: 'authenticated',
    })
    useAccountMock.mockReturnValue({ address: '0xBBB', isConnected: true })
    
    await act(async () => {
      renderWithProviders(
          <Page {...defaultProps} />
      )
    })
    
    // Wait for microtasks to confirm no call was made
    await waitFor(() => {
      expect(axiosGet).not.toHaveBeenCalled()
    })
  })

  it('calls guide-status API for each guide when session exists', async () => {
    const mockGuideStatus1 = { completed: true, receivedScholarship: false }
    const mockGuideStatus2 = { completed: false, receivedScholarship: true }

    axiosGet.mockImplementation((url: string, ..._rest: unknown[]): Promise<AxiosGetReturn> => {
      if (url.startsWith(API_BUSCA_URL)) {
        return Promise.resolve({ data: [mockCourse] })
      }
      if (url.startsWith(API_PRESENTA_URL)) {
        return Promise.resolve({ data: mockCourse })
      }
      if (url.includes('/api/guide-status')) {
        if (url.includes('guideNumber=1')) {
          return Promise.resolve({ data: mockGuideStatus1 })
        }
        if (url.includes('guideNumber=2')) {
          return Promise.resolve({ data: mockGuideStatus2 })
        }
      }
      if (url.includes('/api/scholarship')) {
        return Promise.resolve({ data: { percentageCompleted: null } })
      }
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      renderWithProviders(
          <Page {...defaultProps} />
      )
    })

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText(/GoodDollar Course/)).toBeInTheDocument()
    })

    // Verify guide-status calls were made
    const guideStatusCalls = axiosGet.mock.calls.filter((call: [string, ...unknown[]]) =>
      call[0] && typeof call[0] === 'string' && call[0].includes('/api/guide-status')
    )
    expect(guideStatusCalls.length).toBe(2)
    
    const guideNumbers = guideStatusCalls.map((call: [string, ...unknown[]]) => {
      const url = call[0] as string
      const match = url.match(/guideNumber=(\d+)/)
      return match ? parseInt(match[1]) : 0
    })
    expect(guideNumbers).toContain(1)
    expect(guideNumbers).toContain(2)
  })

  it('includes completion indicators in guide list HTML', async () => {
    const mockGuideStatus1 = { completed: true, receivedScholarship: true }
    const mockGuideStatus2 = { completed: false, receivedScholarship: false }

    axiosGet.mockImplementation((url: string, ..._rest: unknown[]): Promise<AxiosGetReturn> => {
      if (url.startsWith(API_BUSCA_URL)) {
        return Promise.resolve({ data: [mockCourse] })
      }
      if (url.startsWith(API_PRESENTA_URL)) {
        return Promise.resolve({ data: mockCourse })
      }
      if (url.includes('/api/guide-status')) {
        if (url.includes('guideNumber=1')) {
          return Promise.resolve({ data: mockGuideStatus1 })
        }
        if (url.includes('guideNumber=2')) {
          return Promise.resolve({ data: mockGuideStatus2 })
        }
      }
      if (url.includes('/api/scholarship')) {
        return Promise.resolve({ data: { percentageCompleted: null } })
      }
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      renderWithProviders(
          <Page {...defaultProps} />
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/Course contents/)).toBeInTheDocument()
    })

    const guide1Element = screen.getByText(/Guide 1/)
    expect(guide1Element).toBeInTheDocument()
    const parent1 = guide1Element.parentElement
    expect(parent1?.textContent).toMatch(/Guide 1 ✅\s*💰/)

    const guide2Element = screen.getByText(/Guide 2/)
    expect(guide2Element).toBeInTheDocument()
    const parent2 = guide2Element.parentElement
    expect(parent2?.textContent).not.toMatch(/✅/)
    expect(parent2?.textContent).not.toMatch(/💰/)
  })

  it('does not call guide-status API when no session', async () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' })
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false })

    axiosGet.mockImplementation((url: string, ..._rest: unknown[]): Promise<AxiosGetReturn> => {
        if (url.startsWith(API_BUSCA_URL)) {
            return Promise.resolve({ data: [mockCourse] })
        }
        if (url.startsWith(API_PRESENTA_URL)) {
            return Promise.resolve({ data: mockCourse })
        }
        if (url.includes('/api/scholarship')) {
          return Promise.resolve({ data: { percentageCompleted: null } })
        }
        return Promise.resolve({ data: [] })
    })

    await act(async () => {
      renderWithProviders(
          <Page {...defaultProps} />
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/GoodDollar Course/)).toBeInTheDocument()
    })

    const guideStatusCalls = axiosGet.mock.calls.filter((call: [string, ...unknown[]]) =>
      call[0] && typeof call[0] === 'string' && call[0].includes('/api/guide-status')
    )
    expect(guideStatusCalls.length).toBe(0)
  })

  it('handles guide-status API errors gracefully', async () => {
    axiosGet.mockImplementation((url: string, ..._rest: unknown[]): Promise<AxiosGetReturn> => {
      if (url.startsWith(API_BUSCA_URL)) {
        return Promise.resolve({ data: [mockCourse] })
      }
      if (url.startsWith(API_PRESENTA_URL)) {
        return Promise.resolve({ data: mockCourse })
      }
      if (url.includes('/api/guide-status')) {
        return Promise.reject(new Error('API error'))
      }
      if (url.includes('/api/scholarship')) {
        return Promise.resolve({ data: { percentageCompleted: null } })
      }
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      renderWithProviders(
          <Page {...defaultProps} />
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/API error/)).toBeInTheDocument()
    })
  })
})

// --- NEW TEST SUITE ---

// It's necessary to mock the hook used by the new tests
vi.mock('@/lib/hooks/useGuideData')
vi.mock('@/components/DonateModal', () => ({
  DonateModal: ({ isOpen, courseId, lang }: { isOpen: boolean, courseId: number, lang: string }) => {
    if (!isOpen) return null
    return (
      <div data-testid="donate-modal">
        <h2>{lang === 'es' ? 'Donar al curso' : 'Donate to course'} #{courseId}</h2>
      </div>
    )
  }
}))


describe('Course Introduction Page', () => {
  const mockParams = Promise.resolve({ lang: 'en', pathPrefix: 'course1' })

  const mockSessionData = {
    data: {
      address: '0x1234567890123456789012345678901234567890',
      user: { id: '1', name: 'Test User', email: 'test@example.com' },
      expires: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
    },
    status: 'authenticated',
  }

  const mockAccountData = {
    address: '0x1234567890123456789012345678901234567890',
    isConnecting: false,
    isReconnecting: false,
    isConnected: true,
  }

  const mockCourseData: Course = {
      id: '1',
      titulo: 'Test Course',
      subtitulo: 'Test Subtitle',
      idioma: 'en',
      prefijoRuta: 'test-course',
      guias: [],
      conBilletera: true,
      sinBilletera: false,
      creditosMd: '',
      resumenMd: 'Summary text',
      ampliaMd: '',
      imagen: '/test.jpg',
      altImagen: 'Test image',
      enlaceImagen: 'https://example.com',
      creditoImagen: 'Credit'
  }

  const mockGuideData = {
    course: mockCourseData,
    loading: false,
    error: null,
    percentageCompleted: 50,
    percentagePaid: 25,
    amountScholarship: 1000000, // 1 USDT
    scholarshipPerGuide: 500000, // 0.5 USDT
    isEligible: true,
    myGuide: null, guideNumber: 0, nextGuidePath: '', previousGuidePath: '', coursePath: '/en/course1',
  }
  
  // Cast the mocked hooks to be able to set their return values
  const useGuideDataMock = useGuideData as vi.Mock
  const localUseSessionMock = useSession as vi.Mock
  const localUseAccountMock = useAccount as vi.Mock

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Set the return values for the hooks for this test suite
    localUseSessionMock.mockReturnValue(mockSessionData)
    localUseAccountMock.mockReturnValue(mockAccountData)
    useGuideDataMock.mockReturnValue(mockGuideData)
  })

  it('should render loading state', async () => {
    useGuideDataMock.mockReturnValue({ ...mockGuideData, loading: true })
    renderWithProviders(<Page params={mockParams} />)
    await waitFor(() => { expect(screen.getByText('Loading...')).toBeInTheDocument() })
  })

  it('should render error state', async () => {
    useGuideDataMock.mockReturnValue({ ...mockGuideData, error: 'Test Error' })
    renderWithProviders(<Page params={mockParams} />)
    await waitFor(() => { expect(screen.getByText('Error: Test Error')).toBeInTheDocument() })
  })
  
  it('should render course not found', async () => {
    useGuideDataMock.mockReturnValue({ ...mockGuideData, course: null })
    renderWithProviders(<Page params={mockParams} />)
    await waitFor(() => { expect(screen.getByText('Course not found.')).toBeInTheDocument() })
  })

  it('should display scholarship information when eligible', async () => {
    renderWithProviders(<Page params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText(/Scholarship per approved guide/i)).toBeInTheDocument()
      expect(screen.getByText(/0.5 USDT/i)).toBeInTheDocument()
      expect(screen.getByText(/Total USDT earned/i)).toBeInTheDocument()
      expect(screen.getByText(/1 USDT/i)).toBeInTheDocument()
      expect(screen.getByText(/You are eligible for the scholarship/i)).toBeInTheDocument()
    })
  })

  it('should display "not eligible" message when not eligible', async () => {
    useGuideDataMock.mockReturnValue({ ...mockGuideData, isEligible: false })
    renderWithProviders(<Page params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText(/You are not eligible for the scholarship/i)).toBeInTheDocument()
    })
  })

  it('should open DonateModal when donate button is clicked', async () => {
    renderWithProviders(<Page params={mockParams} />)

    await waitFor(() => {
      expect(screen.queryByTestId('donate-modal')).not.toBeInTheDocument()
    })

    const donateButton = await screen.findByRole('button', { name: /Donate to this course/i })
    fireEvent.click(donateButton)

    await waitFor(() => {
      expect(screen.getByTestId('donate-modal')).toBeInTheDocument()
      expect(screen.getByText(/Donate to course #1/i)).toBeInTheDocument()
    })
  })
})