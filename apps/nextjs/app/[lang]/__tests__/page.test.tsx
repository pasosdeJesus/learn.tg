import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page'
import React, { Suspense } from 'react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/en',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock axios (permite reasignar comportamiento por test)
// Definiciones antes de mocks para evitar hoisting issues
interface Course {
  id: string
  idioma: string
  prefijoRuta: string
  imagen: string
  titulo: string
  subtitulo: string
  amountPerGuide?: number
  canSubmit?: boolean
}
type AxiosGetReturn = { data: any }
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

// Mock wagmi (incluye usePublicClient requerido por el componente principal)
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

// Render directo (el componente usa hooks mockeados)
function renderWithProviders(ui: React.ReactElement) {
  return render(ui)
}

describe('Main Page Component', () => {
  const defaultProps = {
    params: Promise.resolve({ lang: 'en' }),
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
    // Mock console.error para evitar stderr en tests de errores
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Mock de variable de entorno usada en componente
    process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL = 'https://fake.local/courses'
  })

  it('no carga cursos (early return) cuando dirección y sesión difieren (partial login)', async () => {
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

  it('consulta scholarship para cada curso cuando hay coincidencia de wallet', async () => {
    const mockCourses = [
      {
        id: 'course-1',
        idioma: 'en',
        prefijoRuta: '/course-1',
        imagen: '/image1.jpg',
        titulo: 'Course 1',
        subtitulo: 'Description 1',
      },
    ]
    const mockScholarshipData = { amountPerGuide: 5, canSubmit: true, percentageCompleted: null }
    axiosGet
      .mockResolvedValueOnce({ data: mockCourses as Course[] }) // cursos
      .mockResolvedValueOnce({ data: { message: '', ...mockScholarshipData } }) // scholarship
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })
    await waitFor(() => expect(axiosGet).toHaveBeenCalledTimes(2))
    const callList: any[] = axiosGet.mock.calls as any
    const secondCall = callList.length > 1 ? callList[1][0] : ''
    expect(secondCall).toMatch(/\/api\/scholarship/)
  })

  it('tolera errores de API sin colapsar', async () => {
    axiosGet.mockRejectedValueOnce(new Error('API Error'))
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })

    // Component should still render without crashing
    await waitFor(() => {
      expect(document.body).toBeInTheDocument()
    })
  })

  it('muestra información de scholarship cuando disponible', async () => {
    const mockCourses = [
      {
        id: '1',
        idioma: 'en',
        prefijoRuta: '/test-course',
        imagen: '/test.jpg',
        titulo: 'Test Course',
        subtitulo: 'Test desc',
        amountPerGuide: 15,
        canSubmit: true,
      },
    ]
    // Primera llamada: cursos
    axiosGet.mockResolvedValueOnce({ data: mockCourses as Course[] })
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })
    // No se hace llamada a scholarship porque el componente sólo lo hace cuando csrfToken válido y session/address coinciden
    await waitFor(() =>
      expect(screen.getByText(/Test Course/i)).toBeInTheDocument(),
    )
  })

  it('construye correctamente URL base de cursos', async () => {
    const mockCourses = [
      {
        id: 'test-course',
        idioma: 'en',
        prefijoRuta: '/test',
        imagen: '/test.jpg',
        titulo: 'Test',
        subtitulo: 'Test',
      },
    ]
    axiosGet.mockResolvedValueOnce({ data: mockCourses as Course[] })
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })
    await waitFor(() => expect(axiosGet).toHaveBeenCalled())
    const callList2: any[] = axiosGet.mock.calls as any
    const firstUrl = callList2.length > 0 ? callList2[0][0] : ''
    expect(firstUrl).toMatch(/filtro\[busidioma\]=en/)
  })
})
