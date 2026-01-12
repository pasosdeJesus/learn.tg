import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page'
import React, { Suspense } from 'react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/en/gooddollar',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
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
  return render(ui)
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
      data: { address: '0x123', user: { name: 'Test User' } },
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
      data: { address: '0xAAA', user: { name: 'Test User' } },
      status: 'authenticated',
    })
    useAccountMock.mockReturnValue({ address: '0xBBB', isConnected: true })
    
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div>Loading...</div>}>
          <Page {...defaultProps} />
        </Suspense>,
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
        <Suspense fallback={<div>Loading...</div>}>
          <Page {...defaultProps} />
        </Suspense>,
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
        <Suspense fallback={<div>Loading...</div>}>
          <Page {...defaultProps} />
        </Suspense>,
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
        <Suspense fallback={<div>Loading...</div>}>
          <Page {...defaultProps} />
        </Suspense>,
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
        <Suspense fallback={<div>Loading...</div>}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/API error/)).toBeInTheDocument()
    })
  })
})
