import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChurchPage from '../page'

// R-#192: the public church page shows a "Verified" badge when the verifier
// confirmed the registration document, and nothing when it is not.

function church(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Iglesia X',
    country_id: 1,
    city_name: null,
    pastor_name: null,
    cluster_wallet: null,
    registration_verified: false,
    created_at: '2026-01-01T00:00:00.000Z',
    cluster: null,
    ...overrides,
  }
}

function mockFetch(body: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
}

const params = () =>
  Object.assign(Promise.resolve({ lang: 'en', id: '1' }), {
    status: 'fulfilled' as const,
    value: { lang: 'en', id: '1' },
  })

describe('public church page — Verified badge (R-#192)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the badge when registration_verified is true', async () => {
    mockFetch(church({ registration_verified: true }))
    render(<ChurchPage params={params()} />)
    expect(await screen.findByTestId('church-verified-badge')).toHaveTextContent('Verified')
  })

  it('hides the badge when registration_verified is false', async () => {
    mockFetch(church({ registration_verified: false }))
    render(<ChurchPage params={params()} />)
    expect(await screen.findByText('Iglesia X')).toBeInTheDocument()
    expect(screen.queryByTestId('church-verified-badge')).not.toBeInTheDocument()
  })
})
