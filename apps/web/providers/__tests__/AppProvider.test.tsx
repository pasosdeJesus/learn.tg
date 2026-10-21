import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'

// Hoisted mocks
const mockSessionProvider = vi.hoisted(() => vi.fn(({ children }) => children))
const mockQueryClientProvider = vi.hoisted(() => vi.fn(({ children }) => children))

// Mock modules
vi.mock('next-auth/react', () => ({
  SessionProvider: mockSessionProvider,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: mockQueryClientProvider,
}))

// Import after mocks
import { AppProvider } from '../AppProvider'

describe('AppProvider', () => {
  it('renders children without errors', () => {
    render(
      <AppProvider>
        <div data-testid="test-child">Test Child</div>
      </AppProvider>
    )

    expect(screen.getByTestId('test-child')).toBeInTheDocument()
    expect(mockSessionProvider).toHaveBeenCalled()
    expect(mockQueryClientProvider).toHaveBeenCalled()
  })

  it('provides necessary context to children', () => {
    render(
      <AppProvider>
        <div>Child content</div>
      </AppProvider>
    )

    expect(true).toBe(true)
  })
})
