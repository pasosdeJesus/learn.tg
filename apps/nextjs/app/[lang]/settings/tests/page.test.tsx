import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Página de privacidad del estudiante
// (https://github.com/pasosdeJesus/learn.tg/issues/259 §3.3): dos interruptores
// y la lista de credenciales propias con la revocación.
const apiMocks = vi.hoisted(() => ({
  authedGet: vi.fn(),
  authedPatch: vi.fn(),
  authedPost: vi.fn(),
  toast: vi.fn(),
  address: '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c',
}))

vi.mock('@/lib/hooks/useAuthedApi', () => ({
  useAuthedApi: () => ({
    authedGet: apiMocks.authedGet,
    authedPatch: apiMocks.authedPatch,
    authedPost: apiMocks.authedPost,
    ready: true,
    wallet: apiMocks.address,
  }),
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/use-toast', () => ({
  useToast: () => ({ toast: apiMocks.toast }),
}))

const CREDENTIALS = [
  {
    tokenId: 3,
    courseId: 10,
    earnedAt: '2026-09-20T10:00:00.000Z',
    isPremium: true,
    revokedAt: null,
    revokeHash: null,
    courseName: 'Global Disciples',
    christianContent: true,
  },
  {
    tokenId: 7,
    courseId: 1,
    earnedAt: '2026-09-19T10:00:00.000Z',
    isPremium: false,
    revokedAt: '2026-09-21T10:00:00.000Z',
    revokeHash: '0xdead',
    courseName: 'Web3 and UBI',
    christianContent: false,
  },
]

function settings(overrides: Record<string, unknown> = {}) {
  return {
    publicCourses: true,
    publicChristianCourses: false,
    persecutionCountry: false,
    country: 'Colombia',
    credentials: CREDENTIALS,
    ...overrides,
  }
}

describe('Settings (privacy) page', () => {
  beforeAll(async () => {
    vi.mock('react', async () => {
      const actual = await vi.importActual('react')
      return {
        ...actual,
        use: (promise: any) => {
          if (promise && typeof promise.then === 'function') return { lang: 'en' }
          return promise
        },
      }
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.authedGet.mockResolvedValue({ data: settings() })
    apiMocks.authedPatch.mockResolvedValue({ data: settings({ publicChristianCourses: true }) })
    apiMocks.authedPost.mockResolvedValue({ data: { minted: [], skipped: [] } })
  })

  async function renderPage() {
    const Page = (await import('../page')).default
    render(<Page params={Promise.resolve({ lang: 'en' })} />)
    await waitFor(() => expect(apiMocks.authedGet).toHaveBeenCalledWith('/api/settings'))
  }

  it('reads the settings and lists the owner credentials', async () => {
    await renderPage()

    expect(screen.getByText('Privacy')).toBeInTheDocument()
    expect(screen.getByText('Global Disciples')).toBeInTheDocument()
    expect(screen.getByText('Web3 and UBI')).toBeInTheDocument()
    // Una revocada se muestra, no se ofrece revocar de nuevo
    expect(screen.getByText('Revoked')).toBeInTheDocument()
    expect(screen.getAllByText('Revoke')).toHaveLength(1)
  })

  it('shows both switches reflecting the stored values', async () => {
    await renderPage()

    const publicSwitch = screen.getByLabelText('Publish my completed courses')
    const christianSwitch = screen.getByLabelText('Publish my courses with Christian content')

    expect(publicSwitch).toHaveAttribute('data-state', 'checked')
    expect(christianSwitch).toHaveAttribute('data-state', 'unchecked')
  })

  it('warns about the risk as soon as Christian publishing is on', async () => {
    apiMocks.authedGet.mockResolvedValue({
      data: settings({ publicChristianCourses: true }),
    })

    await renderPage()

    expect(screen.getByText('Before you turn this on')).toBeInTheDocument()
    // ...and offers to issue the credentials that were withheld
    expect(screen.getByText('Issue pending credentials')).toBeInTheDocument()
  })

  it('does not warn while the Christian switch is off', async () => {
    await renderPage()

    expect(screen.queryByText('Before you turn this on')).not.toBeInTheDocument()
    expect(screen.queryByText('Issue pending credentials')).not.toBeInTheDocument()
  })

  it('saves a switch change through PATCH', async () => {
    await renderPage()

    fireEvent.click(screen.getByLabelText('Publish my courses with Christian content'))

    await waitFor(() => expect(apiMocks.authedPatch).toHaveBeenCalledWith(
      '/api/settings',
      { mostrarCursosCristianosPublico: true },
    ))
  })

  it('reverts the switch when saving fails', async () => {
    apiMocks.authedPatch.mockRejectedValue(new Error('offline'))

    await renderPage()

    const christianSwitch = screen.getByLabelText('Publish my courses with Christian content')
    fireEvent.click(christianSwitch)

    await waitFor(() => expect(apiMocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Could not save your settings.' }),
    ))
    await waitFor(() => expect(christianSwitch).toHaveAttribute('data-state', 'unchecked'))
  })

  it('does not query the API while nobody is connected', async () => {
    apiMocks.address = ''
    const Page = (await import('../page')).default

    render(<Page params={Promise.resolve({ lang: 'en' })} />)

    await waitFor(() => expect(screen.getByText('Could not load your settings.')).toBeInTheDocument())
    expect(apiMocks.authedGet).not.toHaveBeenCalled()
    apiMocks.address = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'
  })

  // El estado inicial del interruptor cristiano depende del pais (migracion
  // 20260923150546): la pagina lo dice para que no parezca decidido por la persona.
  it('explains that the switch starts off in a country that persecutes Christians', async () => {
    apiMocks.authedGet.mockResolvedValue({
      data: settings({ persecutionCountry: true, publicChristianCourses: false, country: 'Corea del Norte' }),
    })

    await renderPage()

    expect(screen.getByTestId('christian-default-note')).toHaveTextContent(/starts turned off/)
  })

  it('explains the country-based default when it starts on', async () => {
    apiMocks.authedGet.mockResolvedValue({
      data: settings({ persecutionCountry: false, publicChristianCourses: true }),
    })

    await renderPage()

    expect(screen.getByTestId('christian-default-note')).toHaveTextContent(/starts turned on/)
  })

  it('does not explain a default while the switch is off in a country without persecution', async () => {
    await renderPage()

    expect(screen.queryByTestId('christian-default-note')).not.toBeInTheDocument()
  })
})
