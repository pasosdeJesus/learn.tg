import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { SessionProvider } from 'next-auth/react'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import Header from '../Header'
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

describe('Header', () => {
  it('renders logo and title in English', () => {
    renderWithProviders(<Header lang="en" />)
    expect(screen.getByAltText('logo')).toBeInTheDocument()
    expect(screen.getByText(/Learn through games/)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/')
  })

  it('renders title in Spanish', () => {
    renderWithProviders(<Header lang="es" />)
    expect(screen.getByText(/Aprender mediante juegos/)).toBeInTheDocument()
  })

  it('shows ConnectButton when MiniPay is not present', () => {
    renderWithProviders(<Header lang="en" />)
    expect(screen.getByText(/Connect/)).toBeInTheDocument()
  })

  it('hides ConnectButton when MiniPay is present', () => {
    window.ethereum = { isMiniPay: true }
    renderWithProviders(<Header lang="en" />)
    expect(screen.queryByText(/Connect/)).not.toBeInTheDocument()
  })
})
