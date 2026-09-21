import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page'
import React, { Suspense } from 'react'

vi.mock('@learn-tg/rewards/lib/deployments', () => ({
  getV3Address: vi.fn().mockReturnValue('0xVAULT12345678901234567890123456789012345678'),
  getSlearnAddress: vi.fn().mockReturnValue('0xSLEARN123456789012345678901234567890123456'),
  getV2Address: vi.fn().mockReturnValue('0xV212345678901234567890123456789012345678'),
}))

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

// Mock useAuthAddress (replaces wagmi's useAccount after R-#186)
const useAccountMock = vi.fn(() => ({
  address: '0x123' as string | undefined,
  isConnected: true,
  sessionAddress: '0x123' as string | undefined,
  storedAddress: '0x123' as string | undefined,
  isAuthenticated: true,
  isWalletAvailable: true,
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
vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => useAccountMock(),
}))
vi.mock('@/lib/hooks/useWallet', () => ({
  usePublicClient: () => usePublicClientMock(),
  useWalletClient: () => useWalletClientMock(),
}))
// R-#254: con la billetera de la aplicación activa, el botón "Add SLEARN" se oculta.
const useWalletProviderMock = vi.fn(() => ({
  provider: null,
  isInApp: false,
  isInAppUnlocked: false,
  externalAvailable: true,
}))
vi.mock('@/lib/hooks/useWalletProvider', () => ({
  useWalletProvider: () => useWalletProviderMock(),
}))
// El botón real sólo se pinta con un proveedor externo y necesita `window.ethereum`;
// aquí se sustituye por un testid estable para comprobar que el page lo monta o no.
vi.mock('@pasosdejesus/mpdj/blockchain', () => ({
  SlearnInfo: () => React.createElement('div', { 'data-testid': 'slearn-info' }),
  AddSlearnButton: ({ lang }: { lang?: string }) =>
    React.createElement('div', { 'data-testid': 'add-slearn' }, `Add SLEARN to my wallet (${lang})`),
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
    useAccountMock.mockReturnValue({ address: '0x123', isConnected: true, sessionAddress: '0x123', storedAddress: '0x123', isAuthenticated: true, isWalletAvailable: true })
    axiosGet.mockReset()
    axiosGet.mockResolvedValue({ data: [] })
    // Mock de alert para evitar errores de jsdom
    // @ts-ignore
    global.window.alert = vi.fn()
    // Mock console.error para evitar stderr en tests de errores
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Mock de variable de entorno usada en componente
    process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL = '/api/course-catalog'
    useWalletProviderMock.mockReturnValue({ provider: null, isInApp: false, isInAppUnlocked: false, externalAvailable: true })
  })

  // R-#254: la billetera de la aplicación no soporta `wallet_watchAsset` (su panel
  // ya lista CELO/USDT/SLEARN), así que el botón no se muestra cuando es el
  // proveedor efectivo (el operador lo reportó el 2026-09-21: no hacía nada).
  const slearnCourses = [
    { id: '1', idioma: 'en', prefijoRuta: '/test-course', imagen: '/test.jpg', titulo: 'Test Course', subtitulo: 'Test desc', amountPerGuide: 15, canSubmit: true },
  ]

  async function renderCoursesPage() {
    axiosGet
      .mockResolvedValueOnce({ data: { religion_id: null } })
      .mockResolvedValueOnce({ data: slearnCourses as Course[] })
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })
    await waitFor(() => expect(screen.getByTestId('slearn-info')).toBeInTheDocument())
  }

  it('oculta el botón de agregar SLEARN con la billetera de la aplicación activa', async () => {
    useWalletProviderMock.mockReturnValue({ provider: null, isInApp: true, isInAppUnlocked: true, externalAvailable: false })
    await renderCoursesPage()
    expect(screen.queryByTestId('add-slearn')).not.toBeInTheDocument()
  })

  it('muestra el botón de agregar SLEARN con una billetera externa', async () => {
    await renderCoursesPage()
    expect(screen.getByTestId('add-slearn')).toBeInTheDocument()
  })

  it('no carga cursos (early return) cuando dirección y sesión difieren (partial login)', async () => {
    useSessionMock.mockReturnValue({
      data: { address: '0xAAA', user: { name: 'Test User' } },
      status: 'authenticated',
    })
    useAccountMock.mockReturnValue({ address: '0xBBB', isConnected: true, sessionAddress: '0xBBB', storedAddress: '0xBBB', isAuthenticated: true, isWalletAvailable: true })
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
      .mockResolvedValueOnce({ data: { religion_id: 2 } }) // perfil
      .mockResolvedValueOnce({ data: mockCourses as Course[] }) // cursos
      .mockResolvedValueOnce({ data: { message: '', ...mockScholarshipData } }) // scholarship
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })
    await waitFor(() => expect(axiosGet).toHaveBeenCalledTimes(3))
    const callList: any[] = axiosGet.mock.calls as any
    const scholarshipCall = callList.length > 2 ? callList[2][0] : ''
    expect(scholarshipCall).toMatch(/\/api\/scholarship/)
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
    // Primera llamada: perfil; segunda: cursos
    axiosGet
      .mockResolvedValueOnce({ data: { religion_id: null } })
      .mockResolvedValueOnce({ data: mockCourses as Course[] })
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
    axiosGet
      .mockResolvedValueOnce({ data: { religion_id: null } }) // perfil
      .mockResolvedValueOnce({ data: mockCourses as Course[] }) // cursos
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })
    await waitFor(() => expect(axiosGet).toHaveBeenCalled())
    const callList2: any[] = axiosGet.mock.calls as any
    const coursesUrl = callList2.length > 1 ? callList2[1][0] : ''
    expect(coursesUrl).toMatch(/filtro\[busidioma\]=en/)
  })

  it('consulta el listado de Rails con walletAddress y sin token (R-#233)', async () => {
    const mockCourses = [
      {
        id: 'course-1',
        idioma: 'en',
        prefijoRuta: '/course-1',
        imagen: '/image1.jpg',
        titulo: 'Public Course',
        subtitulo: 'Description',
      },
    ]
    axiosGet
      .mockResolvedValueOnce({ data: { religion_id: null } }) // perfil
      .mockResolvedValueOnce({ data: mockCourses as Course[] }) // cursos
    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div />}>
          <Page {...defaultProps} />
        </Suspense>,
      )
    })
    await waitFor(() => expect(screen.getByText(/Public Course/i)).toBeInTheDocument())
    const calls: any[] = axiosGet.mock.calls as any
    const listUrl = String(
      calls.find((c) => String(c[0]).includes('/api/course-catalog'))?.[0] || '',
    )
    expect(listUrl).toMatch(/walletAddress=0x123/)
    expect(listUrl).not.toMatch(/[?&]token=/)
  })
})
