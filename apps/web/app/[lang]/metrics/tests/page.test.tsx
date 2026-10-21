import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { mockMetricsQueries } from '@/test-utils/learn-tg-mocks'
import React from 'react'

// El panel de métricas es interno: `MetricsDashboardPage` verifica la sesión y que la
// billetera esté en `NEXT_PUBLIC_VERIFIER_WALLET` antes de calcular nada (el endpoint
// `/api/metrics` hace lo mismo con `authenticateAdmin`). La variable se lee al importar
// el módulo, así que se fija antes (hoisted).

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_VERIFIER_WALLET = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'
})

const VERIFIER = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'

const sessionMock = vi.hoisted(() => ({ getServerSession: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: sessionMock.getServerSession }))

vi.mock('@/app/api/auth/auth-options', () => ({ authOptions: {} }))

// Mock next/dynamic to return simple components with test IDs
const mockDynamicComponent = vi.fn((loader, options) => {
  const TestComponent = vi.fn(() => {
    const loadingText = options?.loading?.()?.props?.children || 'chart'
    return <div data-testid={`mock-${loadingText.toLowerCase().replace(/\s+/g, '-')}`} />
  }) as any
  TestComponent.displayName = 'MockDynamicComponent'
  return TestComponent
})

vi.mock('next/dynamic', () => ({
  default: mockDynamicComponent,
}))

const metricsMocks = mockMetricsQueries()

const EMPTY_METRICS = {
  completionRate: [],
  retention: [],
  timeBetweenGuides: [],
  userGrowth: [],
  gameEngagement: [],
  goodDollarClaims: [],
  lastUpdated: new Date().toISOString(),
}

describe('Metrics Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.getServerSession.mockResolvedValue({ address: VERIFIER })
    metricsMocks.getAllMetrics.mockResolvedValue(EMPTY_METRICS as any)
  })

  it('renders the dashboard for a verifier session', async () => {
    const Page = (await import('../page')).default

    render(await Page({ params: Promise.resolve({ lang: 'en' }) }))

    expect(screen.getByText(/Metrics Dashboard/)).toBeInTheDocument()
    expect(metricsMocks.getAllMetrics).toHaveBeenCalled()
  })

  it('denies access without a session (and does not compute metrics)', async () => {
    sessionMock.getServerSession.mockResolvedValue(null)
    const Page = (await import('../page')).default

    render(await Page({ params: Promise.resolve({ lang: 'en' }) }))

    expect(screen.getByText(/Verifier access required/)).toBeInTheDocument()
    expect(metricsMocks.getAllMetrics).not.toHaveBeenCalled()
  })

  it('denies access for a signed-in wallet that is not a verifier', async () => {
    sessionMock.getServerSession.mockResolvedValue({ address: '0x0000000000000000000000000000000000000001' })
    const Page = (await import('../page')).default

    render(await Page({ params: Promise.resolve({ lang: 'es' }) }))

    expect(screen.getByText(/Acceso restringido a verificadores/)).toBeInTheDocument()
    expect(metricsMocks.getAllMetrics).not.toHaveBeenCalled()
  })
})
