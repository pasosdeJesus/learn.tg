import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { mockMetricsQueries } from '@/test-utils/app/learn-tg-mocks'
import React from 'react'

// Mock next/dynamic to return simple components with test IDs
const mockDynamicComponent = vi.fn((loader, options) => {
  // Determine which chart based on the loader function (simplified)
  const TestComponent = vi.fn(() => {
    // Return a div with a test ID based on the loading text
    const loadingText = options?.loading?.()?.props?.children || 'chart'
    return <div data-testid={`mock-${loadingText.toLowerCase().replace(/\s+/g, '-')}`} />
  }) as any
  TestComponent.displayName = 'MockDynamicComponent'
  return TestComponent
})

vi.mock('next/dynamic', () => ({
  default: mockDynamicComponent,
}))

// Mock metrics queries
const metricsMocks = mockMetricsQueries()

describe('Metrics Dashboard Page', () => {
  beforeAll(async () => {
    // Setup mock metrics data
    metricsMocks.getAllMetrics.mockResolvedValue({
      completionRate: [],
      retention: [],
      timeBetweenGuides: [],
      userGrowth: [],
      gameEngagement: [],
      goodDollarClaims: [],
      lastUpdated: new Date().toISOString(),
    } as any)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    metricsMocks.getAllMetrics.mockResolvedValue({
      completionRate: [],
      retention: [],
      timeBetweenGuides: [],
      userGrowth: [],
      gameEngagement: [],
      goodDollarClaims: [],
      lastUpdated: new Date().toISOString(),
    } as any)
  })

  it('should render without errors', async () => {
    // Dynamically import the page component (it's async)
    const Page = (await import('../page')).default
    expect(() => {
      render(<Page />)
    }).not.toThrow()
  })

  it('should call getAllMetrics', async () => {
    const Page = (await import('../page')).default
    render(<Page />)
    expect(metricsMocks.getAllMetrics).toHaveBeenCalled()
  })

})