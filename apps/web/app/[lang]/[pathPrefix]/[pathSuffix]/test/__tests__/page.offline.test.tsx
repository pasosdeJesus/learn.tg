import { render, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Suspense } from 'react'
import Page from '../page'
import { useGuideData } from '@/lib/hooks/useGuideData'

// Identidad y red fuera de la ecuación: sin conexión la sesión no se resuelve y el
// crucigrama tiene que salir del store del dispositivo (R-#256). Referencias
// estables para no re-disparar el effect de la página.
const apiMocks = vi.hoisted(() => ({
  authedGet: vi.fn(),
  authedPost: vi.fn(),
  // Estado del caso: el archivo prueba sobre todo sin conexión (R-#256), pero
  // también el fallo del servidor en línea (2026-11-05).
  online: false,
  address: undefined as string | undefined,
  ready: false,
}))
const offlineMocks = vi.hoisted(() => ({ getStoredPuzzle: vi.fn() }))
const queueMocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  clearLastRejection: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))
vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({
    address: apiMocks.address,
    sessionAddress: apiMocks.address,
    storedAddress: apiMocks.address,
  }),
}))
vi.mock('@/lib/hooks/useAuthedApi', () => ({
  useAuthedApi: () => ({
    ready: apiMocks.ready,
    mismatch: false,
    authedGet: apiMocks.authedGet,
    authedPost: apiMocks.authedPost,
  }),
}))
vi.mock('@/lib/hooks/useWallet', () => ({
  usePublicClient: () => ({}),
  useWalletClient: () => ({ data: undefined }),
}))
vi.mock('@/lib/hooks/useWriteContract', () => ({
  useWriteContract: () => ({ data: null, writeContract: vi.fn() }),
}))
vi.mock('@/lib/hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    isOffline: !apiMocks.online,
    pending: 0,
    enqueue: queueMocks.enqueue,
    lastRejection: null,
    clearLastRejection: queueMocks.clearLastRejection,
  }),
}))
vi.mock('@/lib/offline-course-db', () => ({
  courseKey: (lang: string, prefix: string) => `${lang}/${prefix}`,
  getStoredPuzzle: offlineMocks.getStoredPuzzle,
}))
vi.mock('@/lib/hooks/useGuideData')

const params = Promise.resolve({
  lang: 'en',
  pathPrefix: 'web3-and-ubi',
  pathSuffix: 'guide4',
})

/** Crucigrama descargado (R-#256 §3.3): celdas y pistas, **nunca** la solución. */
const storedPuzzle = {
  grid: [
    [
      { letter: '', number: 1, isBlocked: false, userInput: '', belongsToWords: [1] },
      { letter: '', isBlocked: true, userInput: '', belongsToWords: [] },
    ],
    [
      { letter: '', number: 2, isBlocked: false, userInput: '', belongsToWords: [2] },
      { letter: '', number: 3, isBlocked: false, userInput: '', belongsToWords: [2] },
    ],
  ],
  placements: [
    { word: '-', row: 0, col: 0, direction: 'across', number: 1, clue: 'First clue' },
    { word: '-', row: 1, col: 0, direction: 'across', number: 2, clue: 'Second clue' },
  ],
}

describe('Crossword page offline (R-#256)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // El estado del crucigrama vive en localStorage: sin limpiarlo, el segundo
    // caso restauraría la cuadrícula del primero y no llegaría al store.
    localStorage.clear()
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    apiMocks.online = false
    apiMocks.address = undefined
    apiMocks.ready = false
    vi.mocked(useGuideData).mockReturnValue({
      course: {
        id: '7',
        idioma: 'en',
        titulo: 'Web3 and UBI',
        sinBilletera: true,
        conBilletera: false,
        prefijoRuta: '/web3-and-ubi',
        creditosMd: '',
        guias: [{ titulo: 'guide4', sufijoRuta: 'guide4' }],
      },
      loading: false,
      error: null,
      myGuide: {
        titulo: 'guide4',
        sufijoRuta: 'guide4',
        completed: false,
        receivedScholarship: false,
        receivedSlearnScholarship: false,
      },
      guideNumber: 4,
      coursePath: '/en/web3-and-ubi',
      nextGuidePath: '',
      previousGuidePath: '',
    } as never)
  })

  it('opens the downloaded puzzle without waiting for the session', async () => {
    offlineMocks.getStoredPuzzle.mockResolvedValue(storedPuzzle)

    // `use(params)` suspende una vez: `act` deja resolver el thenable y pintar.
    await act(async () => {
      render(
        <Suspense fallback={<div>Loading…</div>}>
          <Page params={params} />
        </Suspense>,
      )
    })

    await waitFor(() => {
      expect(document.querySelectorAll('input[data-row]').length).toBe(3)
    })
    expect(document.body.textContent).toContain('First clue')
    expect(offlineMocks.getStoredPuzzle).toHaveBeenCalledWith('en/web3-and-ubi', 'guide4')
    // Nada de red: el crucigrama está en el dispositivo.
    expect(apiMocks.authedGet).not.toHaveBeenCalled()
  })

  it('says the puzzle is missing instead of showing a connection error', async () => {
    offlineMocks.getStoredPuzzle.mockResolvedValue(null)

    await act(async () => {
      render(
        <Suspense fallback={<div>Loading…</div>}>
          <Page params={params} />
        </Suspense>,
      )
    })

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/no saved crossword for this guide/i)
    })
    expect(apiMocks.authedGet).not.toHaveBeenCalled()
  })

  // R-#256: sin sesión, `/api/crossword` responde 200 con la cuadrícula vacía (sin
  // pistas). Eso no es un crucigrama guardado: la página debe decirlo en vez de pintar
  // un tablero sin celdas (medido 2026-09-24 en el sitio de desarrollo).
  it('treats a stored puzzle without placements as missing', async () => {
    offlineMocks.getStoredPuzzle.mockResolvedValue({
      grid: [[{ letter: '', isBlocked: true, userInput: '', belongsToWords: [] }]],
      placements: [],
    })

    await act(async () => {
      render(
        <Suspense fallback={<div>Loading…</div>}>
          <Page params={params} />
        </Suspense>,
      )
    })

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/no saved crossword for this guide/i)
    })
    expect(document.querySelectorAll('input[data-row]').length).toBe(0)
  })

  // 2026-11-05: `/api/crossword` ya no responde 200 con una cuadrícula vacía
  // cuando no puede construir el crucigrama. La página dice el motivo del servidor
  // y ofrece reintentar; antes quedaba un tablero sin pistas y sin explicación.
  it('says why the server could not build the puzzle and offers to retry', async () => {
    apiMocks.online = true
    apiMocks.address = '0x1111111111111111111111111111111111111111'
    apiMocks.ready = true
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    offlineMocks.getStoredPuzzle.mockResolvedValue(null)
    const failure: any = new Error('Request failed with status code 422')
    failure.response = {
      data: {
        error: 'Guide en/web3-and-ubi/guide4 has no crossword questions',
        code: 'puzzle_unavailable',
      },
    }
    apiMocks.authedGet.mockRejectedValue(failure)

    await act(async () => {
      render(
        <Suspense fallback={<div>Loading…</div>}>
          <Page params={params} />
        </Suspense>,
      )
    })

    // El mensaje del servidor, no el "Request failed with status code 422" de axios.
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/has no crossword questions/)
    })
    expect(document.body.textContent).toMatch(/could not be loaded/)
    expect(apiMocks.authedGet).toHaveBeenCalledTimes(1)

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="puzzle-unavailable"] button')?.click()
    })
    await waitFor(() => expect(apiMocks.authedGet).toHaveBeenCalledTimes(2))
  })

  it('paints the puzzle the server sends', async () => {
    apiMocks.online = true
    apiMocks.address = '0x1111111111111111111111111111111111111111'
    apiMocks.ready = true
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    offlineMocks.getStoredPuzzle.mockResolvedValue(null)
    apiMocks.authedGet.mockResolvedValue({
      data: {
        grid: [
          [
            { letter: '', number: 1, isBlocked: false, userInput: '', belongsToWords: [1] },
            { letter: '', isBlocked: true, userInput: '', belongsToWords: [] },
          ],
        ],
        placements: [
          { word: '-', row: 0, col: 0, direction: 'across', number: 1, clue: 'Server clue' },
        ],
        message: '',
      },
    })

    await act(async () => {
      render(
        <Suspense fallback={<div>Loading…</div>}>
          <Page params={params} />
        </Suspense>,
      )
    })

    await waitFor(() => {
      expect(document.body.textContent).toContain('Server clue')
    })
    expect(document.querySelector('[data-testid="puzzle-unavailable"]')).toBeNull()
  })
})
