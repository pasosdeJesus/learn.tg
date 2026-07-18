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

vi.mock('@/components/ConnectWalletButton', () => ({
  ConnectWalletButton: ({ lang }: { lang?: string }) =>
    React.createElement('span', { 'data-testid': 'connect-wallet-btn' }, 'Connect'),
}))

import Layout from '../Layout'

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

describe('Layout', () => {
  it('renders children', () => {
    renderWithProviders(
      <Layout>
        <div>Test Child</div>
      </Layout>,
    )
    expect(screen.getByText('Test Child')).toBeInTheDocument()
  })
})
