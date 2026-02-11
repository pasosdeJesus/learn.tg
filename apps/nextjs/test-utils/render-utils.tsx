/**
 * Render utilities for component tests
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import * as React from 'react'
import { vi } from 'vitest'
import { render, RenderOptions } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { mainnet } from 'wagmi/chains'

/**
 * Default wagmi configuration for tests
 */
export const testWagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

/**
 * Default query client for tests
 */
export const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

/**
 * Props for renderWithProviders function
 */
export interface RenderWithProvidersOptions extends RenderOptions {
  session?: any
  wagmiConfig?: any
  queryClient?: QueryClient
}

/**
 * Render a React component with all necessary providers for testing
 *
 * @param ui The component to render
 * @param options Configuration options
 * @returns Render result with all providers wrapped
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const {
    session = {
      data: {
        user: { name: 'Test User' },
        address: '0x1234567890123456789012345678901234567890',
      },
      status: 'authenticated' as const,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    wagmiConfig = testWagmiConfig,
    queryClient = testQueryClient,
    ...renderOptions
  } = options

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <RainbowKitProvider>{children}</RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </SessionProvider>
  )

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    session,
    wagmiConfig,
    queryClient,
  }
}

/**
 * Mock implementation of useRouter for Next.js App Router
 */
export function mockUseRouter(overrides: any = {}) {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    route: '/',
    ...overrides,
  }

  vi.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    usePathname: () => mockRouter.pathname,
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  }))

  return mockRouter
}

/**
 * Mock implementation of useSession for component tests
 */
export function mockUseSession(overrides: any = {}) {
  const mockSession = {
    data: {
      user: { name: 'Test User' },
      address: '0x1234567890123456789012345678901234567890',
    },
    status: 'authenticated' as const,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }

  vi.mock('next-auth/react', () => ({
    useSession: () => mockSession,
    getCsrfToken: vi.fn().mockResolvedValue('mock-csrf-token'),
  }))

  return mockSession
}

/**
 * Mock window.location for tests that need URL inspection
 */
export function mockWindowLocation(url: string) {
  const mockLocation = new URL(url)

  Object.defineProperty(window, 'location', {
    value: {
      href: mockLocation.href,
      protocol: mockLocation.protocol,
      host: mockLocation.host,
      hostname: mockLocation.hostname,
      port: mockLocation.port,
      pathname: mockLocation.pathname,
      search: mockLocation.search,
      hash: mockLocation.hash,
      origin: mockLocation.origin,
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
    writable: true,
  })
}

/**
 * Reset all mocks to their initial state
 */
export function resetAllMocks() {
  vi.clearAllMocks()
  vi.resetAllMocks()
}