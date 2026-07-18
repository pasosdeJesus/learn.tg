import { SessionProvider } from 'next-auth/react'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
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

describe('Header', () => {
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
})
