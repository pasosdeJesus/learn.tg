import { SessionProvider } from 'next-auth/react'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const useSessionMock = vi.fn(() => ({ data: null, status: 'unauthenticated' }))
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useSession: (...args: unknown[]) => useSessionMock(...args),
  getCsrfToken: () => Promise.resolve('mock-csrf-token'),
}))

// ConnectWalletButton is client-only with window.ethereum — mock it
vi.mock('@/components/ConnectWalletButton', () => ({
  ConnectWalletButton: ({ lang }: { lang?: string }) =>
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

/** Abre el menú ☰ y devuelve los hrefs de sus ítems. */
async function openMenuHrefs() {
  fireEvent.click(screen.getByRole('button', { name: /Menu/ }))
  return screen
    .queryAllByRole('link')
    .map((l) => l.getAttribute('href'))
    .filter(Boolean) as string[]
}

describe('Header', () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' })
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
})
