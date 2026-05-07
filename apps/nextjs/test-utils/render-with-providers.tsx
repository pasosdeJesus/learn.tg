/**
 * renderWithProviders — test helper that wraps components with all mocked providers.
 *
 * Uses the mocks from vitest.setup.ts (wagmi, next-auth, rainbowkit, tanstack query).
 * For customization, pass a custom `wrapper` or configure mocks before calling.
 *
 * Usage:
 *
 *   import { renderWithProviders } from '@/test-utils/render-with-providers'
 *
 *   it('renders with wallet connected', () => {
 *     apiAuthMocks.updateConfig({ address: '0x123', isConnected: true })
 *     renderWithProviders(<MyComponent />)
 *     expect(screen.getByText('Hello')).toBeInTheDocument()
 *   })
 */
import React from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'

const config = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

interface ProvidersProps {
  children: React.ReactNode
  session?: any
}

function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session ?? null}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <RainbowKitProvider>
            {children}
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: { session?: any }
): RenderResult {
  const { session } = options ?? {}
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers session={session}>{children}</Providers>
    ),
  })
}
