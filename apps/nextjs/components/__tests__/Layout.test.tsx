import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { SessionProvider } from 'next-auth/react'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import Layout from '../Layout'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})
const queryClient = new QueryClient()

function renderWithProviders(ui: React.ReactElement) {
  const mockSession = {
    data: { user: { name: 'Test User' }, address: '0x123' },
    status: 'authenticated',
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  }
  return render(
    <SessionProvider session={mockSession}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <RainbowKitProvider>{ui}</RainbowKitProvider>
        </WagmiProvider>
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

  it('renders Header and Footer', () => {
    renderWithProviders(
      <Layout>
        <div>Test Child</div>
      </Layout>,
    )
    expect(screen.getByAltText('logo')).toBeInTheDocument()
    expect(screen.getByText(/Telegram/)).toBeInTheDocument()
  })

  it('detects language from URL', () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/es/other' },
      writable: true,
    })
    renderWithProviders(
      <Layout>
        <div>Test Child</div>
      </Layout>,
    )
    expect(screen.getByText(/Aprender mediante juegos/)).toBeInTheDocument()
  })
})
