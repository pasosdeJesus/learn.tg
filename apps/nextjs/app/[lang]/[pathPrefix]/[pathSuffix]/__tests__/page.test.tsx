import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page.tsx'
import React, { Suspense } from 'react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/en/gooddollar/guide1',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock axios
interface AxiosGetReturn { data: any }
const axiosGet = vi.fn(
  (..._args: any[]): Promise<AxiosGetReturn> => Promise.resolve({ data: [] }),
)
vi.mock('axios', () => ({
  default: { get: (...args: any[]) => axiosGet(...args) },
}))

// Mock next-auth/react
interface SessionLike {
  address: string
  user: { name: string }
}
const useSessionMock = vi.fn((): { data: SessionLike; status: string } => ({
  data: { address: '0x123', user: { name: 'Test User' } },
  status: 'authenticated',
}))
const getCsrfTokenMock = vi.fn(() => Promise.resolve('mock-csrf-token'))
vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
  getCsrfToken: () => getCsrfTokenMock(),
}))

// Mock wagmi
const useAccountMock = vi.fn((): { address: string; isConnected: boolean } => ({
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

// Mock remarkFillInTheBlank
vi.mock('@/lib/remarkFillInTheBlank.mjs', () => ({
  remarkFillInTheBlank: vi.fn().mockReturnValue({}),
}))

// Mock GoodDollarClaimButton component
vi.mock('@/components/GoodDollarClaimButton', () => ({
  default: () => <div data-testid="gooddollar-claim-button">Mock GoodDollarClaimButton</div>,
}))

// Mock window.fillInTheBlank
if (typeof global.window !== 'undefined') {
  (global.window as any).fillInTheBlank = []
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

// Render with Suspense
function renderWithProviders(ui: React.ReactElement) {
  return render(ui)
}

describe('Guide Page Component', () => {
  const defaultProps = {
    params: Promise.resolve({
      lang: 'en',
      pathPrefix: 'gooddollar',
      pathSuffix: 'guide1'
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Restaurar mocks por defecto
    useSessionMock.mockReturnValue({
      data: { address: '0x123', user: { name: 'Test User' } },
      status: 'authenticated',
    })
    useAccountMock.mockReturnValue({ address: '0x123', isConnected: true })
    axiosGet.mockReset()
    axiosGet.mockResolvedValue({ data: [] })
    // Mock de alert para evitar errores de jsdom
    // @ts-ignore
    global.window.alert = vi.fn()
    // Mock de variables de entorno
    process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL = 'https://fake.local/courses'
    process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL = 'https://fake.local/presenta'
    process.env.NEXT_PUBLIC_API_DESCARGA_URL = 'https://fake.local/descarga'
    process.env.NEXT_PUBLIC_AUTH_URL = 'https://fake.local/auth'
  })

  it('no carga datos cuando dirección y sesión difieren (partial login)', async () => {
    useSessionMock.mockReturnValue({
      data: { address: '0xAAA', user: { name: 'Test User' } },
      status: 'authenticated',
    })
    useAccountMock.mockReturnValue({ address: '0xBBB', isConnected: true })
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })
    // Esperar microtasks para confirmar que no hubo llamada
    await waitFor(() => {
      expect(axiosGet).not.toHaveBeenCalled()
    })
  })

  it('calls guide-status API when session and address match', async () => {
    const mockCourse = {
      id: 'course-1',
      idioma: 'en',
      prefijoRuta: '/gooddollar',
      titulo: 'GoodDollar Course',
      sinBilletera: false,
      conBilletera: true,
      guias: [
        {
          titulo: 'Guide 1',
          sufijoRuta: 'guide1',
        }
      ],
      creditosMd: '# Credits'
    }
    const mockGuideData = {
      markdown: '# Guide Content'
    }
    const mockGuideStatus = {
      completed: true,
      receivedScholarship: false
    }
    axiosGet
      .mockResolvedValueOnce({ data: [mockCourse] }) // busca cursos
      .mockResolvedValueOnce({ data: mockCourse }) // presenta curso
      .mockResolvedValueOnce({ data: mockGuideData }) // descarga guía
      .mockResolvedValueOnce({ data: mockGuideStatus }) // guide-status

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    await waitFor(() => expect(axiosGet).toHaveBeenCalledTimes(4))
    // Verify guide-status call
    const calls = axiosGet.mock.calls
    const guideStatusCall = calls.find(call =>
      call[0] && typeof call[0] === 'string' && call[0].includes('/api/guide-status')
    )
    expect(guideStatusCall).toBeDefined()
    if (guideStatusCall) {
      expect(guideStatusCall[0]).toMatch(/walletAddress=0x123/)
      expect(guideStatusCall[0]).toMatch(/courseId=course-1/)
      expect(guideStatusCall[0]).toMatch(/guideNumber=1/)
    }
  })

  it('shows completion indicator when guide is completed', async () => {
    const mockCourse = {
      id: 'course-1',
      idioma: 'en',
      prefijoRuta: '/gooddollar',
      titulo: 'GoodDollar Course',
      sinBilletera: false,
      conBilletera: true,
      guias: [
        {
          titulo: 'Guide 1',
          sufijoRuta: 'guide1',
        }
      ],
      creditosMd: '# Credits'
    }
    const mockGuideData = {
      markdown: '# Guide Content'
    }
    const mockGuideStatus = {
      completed: true,
      receivedScholarship: false
    }
    axiosGet
      .mockResolvedValueOnce({ data: [mockCourse] }) // busca cursos
      .mockResolvedValueOnce({ data: mockCourse }) // presenta curso
      .mockResolvedValueOnce({ data: mockGuideData }) // descarga guía
      .mockResolvedValueOnce({ data: mockGuideStatus }) // guide-status

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    // Wait for all API calls
    await waitFor(() => {
      expect(axiosGet).toHaveBeenCalledTimes(4)
    })

    // Wait for completion indicator to appear
    await waitFor(() => {
      const titleElement = screen.getByText(/Guide.*1: Guide 1/)
      expect(titleElement.textContent).toContain('✅')
    })
    // Verify scholarship indicator is not present
    const titleElement = screen.getByText(/Guide.*1: Guide 1/)
    expect(titleElement.textContent).toContain('✅')
    expect(titleElement.textContent).not.toContain('💰')
  })

  it('shows scholarship indicator when scholarship received', async () => {
    const mockCourse = {
      id: 'course-1',
      idioma: 'en',
      prefijoRuta: '/gooddollar',
      titulo: 'GoodDollar Course',
      sinBilletera: false,
      conBilletera: true,
      guias: [
        {
          titulo: 'Guide 1',
          sufijoRuta: 'guide1',
        }
      ],
      creditosMd: '# Credits'
    }
    const mockGuideData = {
      markdown: '# Guide Content'
    }
    const mockGuideStatus = {
      completed: true,
      receivedScholarship: true
    }
    axiosGet
      .mockResolvedValueOnce({ data: [mockCourse] })
      .mockResolvedValueOnce({ data: mockCourse })
      .mockResolvedValueOnce({ data: mockGuideData })
      .mockResolvedValueOnce({ data: mockGuideStatus })

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    // Wait for both indicators to appear
    await waitFor(() => {
      const titleElement = screen.getByText(/Guide.*1: Guide 1/)
      expect(titleElement.textContent).toContain('✅')
      expect(titleElement.textContent).toContain('💰')
    })
    // Verify both indicators are present
    const titleElement = screen.getByText(/Guide.*1: Guide 1/)
    expect(titleElement.textContent).toContain('✅')
    expect(titleElement.textContent).toContain('💰')
  })

  it('does not show indicators when guide not completed', async () => {
    const mockCourse = {
      id: 'course-1',
      idioma: 'en',
      prefijoRuta: '/gooddollar',
      titulo: 'GoodDollar Course',
      sinBilletera: false,
      conBilletera: true,
      guias: [
        {
          titulo: 'Guide 1',
          sufijoRuta: 'guide1',
        }
      ],
      creditosMd: '# Credits'
    }
    const mockGuideData = {
      markdown: '# Guide Content'
    }
    const mockGuideStatus = {
      completed: false,
      receivedScholarship: false
    }
    axiosGet
      .mockResolvedValueOnce({ data: [mockCourse] })
      .mockResolvedValueOnce({ data: mockCourse })
      .mockResolvedValueOnce({ data: mockGuideData })
      .mockResolvedValueOnce({ data: mockGuideStatus })

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/Guide.*1: Guide 1/)).toBeInTheDocument()
    })
    // Check that no indicators are present
    const titleElement = screen.getByText(/Guide.*1: Guide 1/)
    expect(titleElement.textContent).not.toMatch(/✅/)
    expect(titleElement.textContent).not.toMatch(/💰/)
  })

  it('handles guide-status API error gracefully', async () => {
    const mockCourse = {
      id: 'course-1',
      idioma: 'en',
      prefijoRuta: '/gooddollar',
      titulo: 'GoodDollar Course',
      sinBilletera: false,
      conBilletera: true,
      guias: [
        {
          titulo: 'Guide 1',
          sufijoRuta: 'guide1',
        }
      ],
      creditosMd: '# Credits'
    }
    const mockGuideData = {
      markdown: '# Guide Content'
    }
    axiosGet
      .mockResolvedValueOnce({ data: [mockCourse] })
      .mockResolvedValueOnce({ data: mockCourse })
      .mockResolvedValueOnce({ data: mockGuideData })
      .mockRejectedValueOnce(new Error('Guide status error')) // guide-status fails

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    // Component should still render without crashing
    await waitFor(() => {
      expect(screen.getByText(/Guide.*1: Guide 1/)).toBeInTheDocument()
    })
    // No indicators shown due to error
    const titleElement = screen.getByText(/Guide.*1: Guide 1/)
    expect(titleElement.textContent).not.toMatch(/✅/)
    expect(titleElement.textContent).not.toMatch(/💰/)
  })
})