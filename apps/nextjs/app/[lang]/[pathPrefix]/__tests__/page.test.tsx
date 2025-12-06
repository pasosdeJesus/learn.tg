import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page.tsx'
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
  Button: ({ children, ...props }: any) => (
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

  it('calls guide-status API for each guide when session exists', async () => {
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
    const mockGuideStatus1 = {
      completed: true,
      receivedScholarship: false
    }
    const mockGuideStatus2 = {
      completed: false,
      receivedScholarship: true
    }
    // First call: busca cursos
    axiosGet.mockResolvedValueOnce({ data: [mockCourse] })
    // Second call: presenta curso (returns mockCourse again)
    axiosGet.mockResolvedValueOnce({ data: mockCourse })
    // Third and fourth calls: guide-status for each guide (will be called via Promise.allSettled)
    // We'll mock the axios.get to return different values based on URL
    axiosGet.mockImplementation((url: string) => {
      if (url.includes('/api/guide-status')) {
        if (url.includes('guideNumber=1')) {
          return Promise.resolve({ data: mockGuideStatus1 })
        } else if (url.includes('guideNumber=2')) {
          return Promise.resolve({ data: mockGuideStatus2 })
        }
      }
      // Default fallback
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText(/GoodDollar Course/)).toBeInTheDocument()
    })

    // Verify guide-status calls were made
    const guideStatusCalls = axiosGet.mock.calls.filter(call =>
      call[0] && typeof call[0] === 'string' && call[0].includes('/api/guide-status')
    )
    expect(guideStatusCalls.length).toBe(2)
    // Verify each guide number
    const guideNumbers = guideStatusCalls.map(call => {
      const url = call[0] as string
      const match = url.match(/guideNumber=(\d+)/)
      return match ? parseInt(match[1]) : 0
    })
    expect(guideNumbers).toContain(1)
    expect(guideNumbers).toContain(2)
  })

  it('includes completion indicators in guide list HTML', async () => {
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
    const mockGuideStatus1 = {
      completed: true,
      receivedScholarship: true  // Both indicators
    }
    const mockGuideStatus2 = {
      completed: false,
      receivedScholarship: false // No indicators
    }
    axiosGet.mockResolvedValueOnce({ data: [mockCourse] })
    axiosGet.mockResolvedValueOnce({ data: mockCourse })
    // Mock guide-status calls
    axiosGet.mockImplementation((url: string) => {
      if (url.includes('/api/guide-status')) {
        if (url.includes('guideNumber=1')) {
          return Promise.resolve({ data: mockGuideStatus1 })
        } else if (url.includes('guideNumber=2')) {
          return Promise.resolve({ data: mockGuideStatus2 })
        }
      }
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    // Wait for content
    await waitFor(() => {
      expect(screen.getByText(/Course contents/)).toBeInTheDocument()
    })

    // Check that guide list contains indicators
    // The content is rendered via dangerouslySetInnerHTML, so we need to check the DOM
    // Look for list items containing guide titles and indicators
    const guide1Element = screen.getByText(/Guide 1/)
    expect(guide1Element).toBeInTheDocument()
    // The indicators are appended as text after the link, so we check parent element
    const parent = guide1Element.parentElement
    expect(parent?.textContent).toMatch(/Guide 1 ✅\s*💰/)

    const guide2Element = screen.getByText(/Guide 2/)
    expect(guide2Element).toBeInTheDocument()
    const parent2 = guide2Element.parentElement
    expect(parent2?.textContent).not.toMatch(/✅/)
    expect(parent2?.textContent).not.toMatch(/💰/)
  })

  it('does not call guide-status API when no session', async () => {
    // No session
    useSessionMock.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false })

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
        }
      ]
    }
    axiosGet.mockResolvedValueOnce({ data: [mockCourse] })
    axiosGet.mockResolvedValueOnce({ data: mockCourse })

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/GoodDollar Course/)).toBeInTheDocument()
    })

    // Verify no guide-status calls
    const guideStatusCalls = axiosGet.mock.calls.filter(call =>
      call[0] && typeof call[0] === 'string' && call[0].includes('/api/guide-status')
    )
    expect(guideStatusCalls.length).toBe(0)
  })

  it('handles guide-status API errors gracefully', async () => {
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
        }
      ]
    }
    axiosGet.mockResolvedValueOnce({ data: [mockCourse] })
    axiosGet.mockResolvedValueOnce({ data: mockCourse })
    // Mock guide-status to fail
    axiosGet.mockImplementation((url: string) => {
      if (url.includes('/api/guide-status')) {
        return Promise.reject(new Error('API error'))
      }
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    // Component should still render without crashing
    await waitFor(() => {
      expect(screen.getByText(/GoodDollar Course/)).toBeInTheDocument()
    })
    // Guide list should still be rendered (without indicators)
    expect(screen.getByText(/Guide 1/)).toBeInTheDocument()
  })
})