/**
 * renderWithProviders — test helper that wraps components with mocked providers.
 *
 * Uses the mocks from vitest.setup.ts (next-auth, tanstack query).
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
        {children}
      </QueryClientProvider>
    </SessionProvider>
  )
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: { session?: any }
): RenderResult {
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <Providers session={options?.session}>{children}</Providers>
    ),
  })
}
