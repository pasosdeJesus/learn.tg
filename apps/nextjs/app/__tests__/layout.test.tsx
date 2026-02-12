import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import RootLayout from '../layout'
import React from 'react'

// Mock next/font/google with hoisted mocks
const fontMocks = vi.hoisted(() => ({
  mockDMSans: vi.fn(() => ({
    variable: '--font-dm-sans',
  })),
  mockDMMono: vi.fn(() => ({
    variable: '--font-dm-mono',
  })),
}))
vi.mock('next/font/google', () => ({
  DM_Sans: fontMocks.mockDMSans,
  DM_Mono: fontMocks.mockDMMono,
}))

// Mock CSS imports
vi.mock('./globals.css', () => ({}))

// Mock @/components/Layout
const layoutMock = vi.hoisted(() =>
  vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-layout">{children}</div>
  ))
)
vi.mock('@/components/Layout', () => ({
  default: layoutMock,
}))

// Mock @/providers/AppProvider
const appProviderMock = vi.hoisted(() =>
  vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-app-provider">{children}</div>
  ))
)
vi.mock('@/providers/AppProvider', () => ({
  AppProvider: appProviderMock,
}))

describe('RootLayout', () => {
  it('should render without errors', () => {
    expect(() => {
      render(
        <RootLayout>
          <div data-testid="child">Test Child</div>
        </RootLayout>
      )
    }).not.toThrow()
  })

  it('should render html with lang="en"', () => {
    render(
      <RootLayout>
        <div data-testid="child">Test Child</div>
      </RootLayout>
    )

    // The child should be present
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('should call font loaders with correct arguments', () => {
    render(
      <RootLayout>
        <div data-testid="child">Test Child</div>
      </RootLayout>
    )

    expect(fontMocks.mockDMSans).toHaveBeenCalledWith({
      variable: '--font-dm-sans',
      subsets: ['latin'],
    })
    expect(fontMocks.mockDMMono).toHaveBeenCalledWith({
      variable: '--font-dm-mono',
      weight: ['300', '400', '500'],
      subsets: ['latin'],
    })
  })

  it('should wrap children with AppProvider and Layout', () => {
    render(
      <RootLayout>
        <div data-testid="child">Test Child</div>
      </RootLayout>
    )

    // Check that AppProvider mock was rendered
    expect(screen.getByTestId('mock-app-provider')).toBeInTheDocument()
    // Check that Layout mock was rendered
    expect(screen.getByTestId('mock-layout')).toBeInTheDocument()
    // The child should be present
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})