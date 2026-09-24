import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import Page from '../page'
import { useGuideData } from '@/lib/hooks/useGuideData'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'
import { useCachedGuide } from '@/lib/hooks/useCachedGuide'

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: 'en', pathPrefix: 'web3-and-ubi', pathSuffix: 'guide4' }),
}))

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: vi.fn(() => ({
    address: undefined,
    sessionAddress: undefined,
    storedAddress: undefined,
    isAuthenticated: false,
    isSessionLoading: false,
  })),
}))

vi.mock('@/lib/hooks/useGuideData')
vi.mock('@/lib/hooks/useAuthedApi')
vi.mock('@/lib/hooks/useCachedGuide')

vi.mock('@/components/GoodDollarClaimButton', () => ({
  GoodDollarClaimButton: () => <div data-testid="gooddollar-claim-button" />,
}))
vi.mock('@/components/CeloUbiButton', () => ({
  default: () => <div data-testid="celo-ubi-button" />,
}))

// El markdown guardado se convierte con unified; aquí sólo interesa que la página
// lo pinte, así que el procesador devuelve un HTML reconocible.
vi.mock('unified', () => ({
  unified: vi.fn(() => {
    const processor: Record<string, unknown> = {}
    processor.use = vi.fn(() => processor)
    processor.processSync = vi.fn(() => ({ toString: () => '<p>SAVED-GUIDE-MARKDOWN</p>' }))
    return processor
  }),
}))

const SAVED_MARKDOWN = '# Saved guide\n\n## Comprehension Questions\n\n1. Question ___ (answer)'

describe('Guide page offline (R-#256)', () => {
  const getCached = vi.fn()
  const authedGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // `navigator.onLine` en false: el fix no debe esperar a `ready`, porque sin
    // conexión la sesión nunca se resuelve.
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })

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
      myGuide: { titulo: 'guide4', sufijoRuta: 'guide4', completed: false, receivedScholarship: false },
      guideNumber: 4,
      nextGuidePath: '',
      previousGuidePath: '',
      coursePath: '/en/web3-and-ubi',
    } as never)

    // La identidad sigue sin resolverse (sin conexión) y el hook estándar no debe
    // usarse para traer contenido que ya está en el dispositivo.
    vi.mocked(useAuthedApi).mockReturnValue({
      ready: false,
      mismatch: false,
      authedGet,
    } as never)

    getCached.mockResolvedValue(SAVED_MARKDOWN)
    vi.mocked(useCachedGuide).mockReturnValue({
      isOffline: true,
      isFromCache: true,
      markFromCache: vi.fn(),
      getCached,
      save: vi.fn(),
      remove: vi.fn(),
    })
  })

  it('paints the guide from the store without waiting for the session', async () => {
    render(<Page />)

    await waitFor(() => {
      expect(document.body.textContent).toContain('SAVED-GUIDE-MARKDOWN')
    })
    expect(getCached).toHaveBeenCalled()
    expect(authedGet).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Showing the saved copy')
  })

  // R-#241/R-#256: la guía visitada de un curso que **no** se puede descargar (de pago
  // o sensible) tiene que seguir leyéndose sin conexión. Antes el gate de
  // `course`/`myGuide` mostraba "Error: Offline" con el Markdown ya en el dispositivo
  // (medido 2026-09-24 en el sitio de desarrollo con `offline-guide`).
  it('paints the stored guide when the course could not be resolved offline', async () => {
    vi.mocked(useGuideData).mockReturnValue({
      course: null,
      loading: false,
      error: 'Offline',
      myGuide: null,
      guideNumber: 0,
      nextGuidePath: '',
      previousGuidePath: '',
      coursePath: '',
    } as never)

    render(<Page />)

    await waitFor(() => {
      expect(document.body.textContent).toContain('SAVED-GUIDE-MARKDOWN')
    })
    expect(document.body.textContent).toContain('Showing the saved copy')
    expect(document.body.textContent).not.toContain('Error: Offline')
  })
})
