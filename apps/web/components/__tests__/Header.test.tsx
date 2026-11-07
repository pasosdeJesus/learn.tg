import { SessionProvider } from 'next-auth/react'
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const useSessionMock = vi.fn((..._args: unknown[]) => ({
  data: null,
  status: 'unauthenticated',
}))
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useSession: (...args: unknown[]) => useSessionMock(...args),
  getCsrfToken: () => Promise.resolve('mock-csrf-token'),
}))

// WalletSelector is client-only (window.ethereum / in-app wallet) — mock it
vi.mock('@/components/WalletSelector', () => ({
  WalletSelector: ({ lang }: { lang?: string }) =>
    React.createElement('span', { 'data-testid': 'connect-wallet-btn' }, 'Connect'),
}))

import Header from '../Header'

const queryClient = new QueryClient()
function renderWithProviders(ui: React.ReactElement) {
  const mockSession = {
    data: { user: { name: 'Test User' }, address: '0x123' },
    status: 'authenticated',
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
  return render(
    <SessionProvider session={mockSession}>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </SessionProvider>,
  )
}

/** Gota 💧 suelta (solo sin sesión): link a /donations/lensenia cuyo texto es exactamente el emoji. */
function standaloneDroplet() {
  return screen
    .queryAllByRole('link')
    .find((l) => l.getAttribute('href')?.endsWith('/donations/lensenia') && l.textContent?.trim() === '💧')
}

const GROUP_IDS = ['account', 'courses', 'gdcluster', 'learntg']

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: /Menu/ }))
}

/** Abre el grupo indicado del menú de dos niveles (R-#161 §15). */
function openGroup(id: string) {
  fireEvent.click(screen.getByTestId(`menu-group-${id}`))
}

/** Abre el menú ☰ y todos los grupos presentes; devuelve los hrefs. */
async function openMenuHrefs() {
  openMenu()
  // Los grupos que dependen de la API (GDCluster) aparecen después del primer
  // render: se deja resolver la promesa antes de abrirlos.
  await new Promise((resolve) => setTimeout(resolve, 0))
  for (const id of GROUP_IDS) {
    const group = screen.queryByTestId(`menu-group-${id}`)
    if (group) fireEvent.click(group)
  }
  return screen
    .queryAllByRole('link')
    .map((l) => l.getAttribute('href'))
    .filter(Boolean) as string[]
}

/** Respuestas de API por URL (el header pregunta perfil, catálogo y estado de clúster). */
function stubApis(overrides: {
  directoryVisible?: boolean
  profile?: Record<string, unknown>
  courses?: Array<Record<string, unknown>>
  clusterStatus?: Record<string, unknown>
} = {}) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const body = String(url).includes('/api/settings')
      ? { directoryVisible: overrides.directoryVisible ?? false }
      : String(url).includes('/api/profile')
        ? (overrides.profile ?? {})
        : String(url).includes('/api/course-catalog')
          ? (overrides.courses ?? [])
          : String(url).includes('/api/cluster/status')
            ? (overrides.clusterStatus ?? { hasCluster: false, noChurch: true })
            : {}
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  }))
}

const AUTHENTICATED = {
  data: { user: { name: 'Test User' }, address: '0x123' },
  status: 'authenticated',
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

describe('Header', () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('renders logo and title in English', () => {
    renderWithProviders(<Header lang="en" />)
    expect(screen.getByAltText('logo')).toBeInTheDocument()
    expect(screen.getByText(/Learn through games/)).toBeInTheDocument()
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/')
  })

  it('renders logo and title in Spanish', () => {
    renderWithProviders(<Header lang="es" />)
    expect(screen.getByAltText('logo')).toBeInTheDocument()
    expect(screen.getByText(/Aprender mediante juegos/)).toBeInTheDocument()
  })

  // R-#230/#231
  it('guest: hamburger menu visible without Profile, Courses present, droplet shown', async () => {
    renderWithProviders(<Header lang="en" />)
    expect(standaloneDroplet()).toBeTruthy()
    const hrefs = await openMenuHrefs()
    expect(hrefs).toContain('/en') // Courses (R-#231)
    expect(hrefs).not.toContain('/en/profile') // sin sesión → sin Profile
    expect(hrefs).toContain('/en/leaderboard')
    expect(hrefs).toContain('/en/transparency')
  })

  // R-#164: el directorio se ofrece sólo a autenticados verificados en país tipo 1.
  it('guest: the church directory is hidden', async () => {
    renderWithProviders(<Header lang="en" />)
    const hrefs = await openMenuHrefs()
    expect(hrefs).not.toContain('/en/directory/churches')
  })

  it('verified in a region-1 country: the directory is shown', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ directoryVisible: true }),
    })))
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Test User' }, address: '0x123' },
      status: 'authenticated',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as never)
    renderWithProviders(<Header lang="en" />)
    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('menu-group-learntg')).toBeInTheDocument()
    })
    openGroup('learntg')
    expect(screen.queryAllByRole('link').map((l) => l.getAttribute('href')))
      .toContain('/en/directory/churches')
  })

  it('region type 2 or unverified: the church directory is hidden', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ directoryVisible: false }),
    })))
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Test User' }, address: '0x123' },
      status: 'authenticated',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as never)
    renderWithProviders(<Header lang="en" />)
    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('menu-group-learntg')).toBeInTheDocument()
    })
    openGroup('learntg')
    expect(screen.queryAllByRole('link').map((l) => l.getAttribute('href')))
      .not.toContain('/en/directory/churches')
  })

  // R-#230
  it('authenticated: droplet hidden and menu includes Profile + Courses', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Test User' }, address: '0x123' },
      status: 'authenticated',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as never)
    renderWithProviders(<Header lang="en" />)
    expect(standaloneDroplet()).toBeUndefined() // 💧 fuera del header con sesión
    const hrefs = await openMenuHrefs()
    expect(hrefs).toContain('/en/profile')
    expect(hrefs).toContain('/en') // Courses (R-#231)
    expect(hrefs).toContain('/en/donations/lensenia') // donación vive en el menú
  })

  // R-#255: el menú ☰ muestra Admin sólo al verificador, en su idioma.
  it('verifier wallet: menu includes Admin (Spanish)', async () => {
    vi.stubEnv('NEXT_PUBLIC_VERIFIER_WALLET', '0xAAA, 0x123 ')
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Test User' }, address: '0x123' },
      status: 'authenticated',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as never)
    renderWithProviders(<Header lang="es" />)
    const hrefs = await openMenuHrefs()
    expect(hrefs).toContain('/es/admin')
  })

  it('non-verifier wallet: no Admin entry', async () => {
    vi.stubEnv('NEXT_PUBLIC_VERIFIER_WALLET', '0xAAA')
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Test User' }, address: '0x123' },
      status: 'authenticated',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as never)
    renderWithProviders(<Header lang="en" />)
    const hrefs = await openMenuHrefs()
    expect(hrefs).toContain('/en/profile')
    expect(hrefs).not.toContain('/en/admin')
  })

  it('guest: no Admin entry even when the wallet is a verifier', async () => {
    vi.stubEnv('NEXT_PUBLIC_VERIFIER_WALLET', '0x123')
    renderWithProviders(<Header lang="en" />)
    const hrefs = await openMenuHrefs()
    expect(hrefs).not.toContain('/en/admin')
  })

  // R-#161 §15: menú de dos niveles; el invitado ve Cursos y learn.tg, sin cuenta.
  it('guest: two-level menu with the courses and learn.tg groups only', async () => {
    renderWithProviders(<Header lang="en" />)
    openMenu()
    expect(screen.getByTestId('menu-group-courses')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('menu-group-learntg')).toBeInTheDocument()
    expect(screen.queryByTestId('menu-group-account')).toBeNull()
    expect(screen.queryByTestId('menu-group-gdcluster')).toBeNull()
    // Cerrado no renderiza enlaces: el grupo se abre al pulsarlo.
    openGroup('courses')
    expect(screen.getByTestId('menu-group-courses')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryAllByRole('link').map((l) => l.getAttribute('href'))).toContain('/en')
  })

  it('authenticated: the account group holds Profile, Privacy and Referrals', async () => {
    stubApis()
    useSessionMock.mockReturnValue(AUTHENTICATED as never)
    renderWithProviders(<Header lang="en" />)
    const hrefs = await openMenuHrefs()
    expect(hrefs).toContain('/en/profile')
    expect(hrefs).toContain('/en/settings')
    expect(hrefs).toContain('/en/referrals')
  })

  // R-#194 + R-#161: la sección GDCluster usa la misma señal que /[lang] para el
  // curso; a quien no se le ofrece el curso no se le muestra la sección.
  it('GDCluster is hidden when the profile lacks the declared position', async () => {
    stubApis({ profile: { religion_id: 2, position_israel_gaza: null } })
    useSessionMock.mockReturnValue(AUTHENTICATED as never)
    renderWithProviders(<Header lang="en" />)
    openMenu()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByTestId('menu-group-gdcluster')).toBeNull()
  })

  it('GDCluster is hidden when the declared religion is not the one the programme requires', async () => {
    stubApis({ profile: { religion_id: 1, position_israel_gaza: 'no' } })
    useSessionMock.mockReturnValue(AUTHENTICATED as never)
    renderWithProviders(<Header lang="en" />)
    openMenu()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByTestId('menu-group-gdcluster')).toBeNull()
  })

  it('GDCluster without the course or the pastor role: only the public ranking', async () => {
    stubApis({
      profile: { religion_id: 2, position_israel_gaza: 'no' },
      courses: [],
      clusterStatus: { hasCluster: false, noChurch: true },
    })
    useSessionMock.mockReturnValue(AUTHENTICATED as never)
    renderWithProviders(<Header lang="en" />)
    const hrefs = await openMenuHrefs()
    expect(hrefs).toContain('/en/gdcluster/ranking')
    expect(hrefs).not.toContain('/en/gdcluster')
    expect(hrefs).not.toContain('/en/cluster')
  })

  it('GDCluster with the course: Budget appears, Cluster still needs the pastor role', async () => {
    stubApis({
      profile: { religion_id: 2, position_israel_gaza: 'no' },
      courses: [{ id: 10, prefijoRuta: '/gdcluster' }],
      clusterStatus: { hasCluster: false, noChurch: true },
    })
    useSessionMock.mockReturnValue(AUTHENTICATED as never)
    renderWithProviders(<Header lang="en" />)
    const hrefs = await openMenuHrefs()
    expect(hrefs).toContain('/en/gdcluster')
    expect(hrefs).not.toContain('/en/cluster')
  })

  it('GDCluster for a pastor with the course: Ranking, Budget and Cluster', async () => {
    stubApis({
      profile: { religion_id: 2, position_israel_gaza: 'no' },
      courses: [{ id: 10, prefijoRuta: '/gdcluster' }],
      clusterStatus: { hasCluster: true, clusterId: 7 },
    })
    useSessionMock.mockReturnValue(AUTHENTICATED as never)
    renderWithProviders(<Header lang="es" />)
    const hrefs = await openMenuHrefs()
    expect(hrefs).toContain('/es/gdcluster/ranking')
    expect(hrefs).toContain('/es/gdcluster')
    expect(hrefs).toContain('/es/cluster')
  })
})
