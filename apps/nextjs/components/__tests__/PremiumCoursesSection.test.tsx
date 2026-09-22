import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  address: '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c' as string | undefined,
  ready: true,
  authedGet: vi.fn(),
}))

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({ address: hooks.address }),
}))

vi.mock('@/lib/hooks/useAuthedApi', () => ({
  useAuthedApi: () => ({ authedGet: hooks.authedGet, ready: hooks.ready }),
}))

import { PremiumCoursesSection } from '../PremiumCoursesSection'

const PURCHASE = {
  course_id: 10,
  purchased_at: '2026-09-20T12:00:00.000Z',
  usdt_amount_paid: '1.10',
  // DECIMAL(10,2) en SLEARN legibles (migración 20260921180000).
  slearn_amount_paid: '10.00',
  transaction_hash: '0xabc123',
  titulo: 'Global Disciples',
  prefijoRuta: '/gdcluster',
  idioma: 'en',
}

// Cierra la casilla "Purchased courses appear in user's profile" de
// https://github.com/pasosdeJesus/learn.tg/issues/128 (§2.3 / §9).
describe('PremiumCoursesSection', () => {
  beforeEach(() => {
    hooks.address = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'
    hooks.ready = true
    hooks.authedGet.mockReset()
    hooks.authedGet.mockResolvedValue({ data: { courses: [PURCHASE] } })
  })

  it('renders nothing without an authenticated address', () => {
    hooks.address = undefined

    const { container } = render(<PremiumCoursesSection lang="en" />)

    expect(container).toBeEmptyDOMElement()
    expect(hooks.authedGet).not.toHaveBeenCalled()
  })

  it('renders nothing when the user has no premium purchases', async () => {
    hooks.authedGet.mockResolvedValue({ data: { courses: [] } })

    const { container } = render(<PremiumCoursesSection lang="en" />)

    await waitFor(() => expect(hooks.authedGet).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('lists the purchase with its date, both amounts and the transaction link', async () => {
    render(<PremiumCoursesSection lang="en" />)

    const link = await screen.findByRole('link', { name: 'Global Disciples' })
    expect(link).toHaveAttribute('href', '/en/gdcluster')
    expect(hooks.authedGet).toHaveBeenCalledWith('/api/courses/premium/mine')
    expect(screen.getByText(/1\.10 USDT/)).toBeInTheDocument()
    expect(screen.getByText(/10\.00 SLEARN/)).toBeInTheDocument()
    expect(screen.getByText(/Purchased on/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View transaction' })).toHaveAttribute(
      'href',
      expect.stringContaining('0xabc123'),
    )
  })

  it('shows only SLEARN for a 100% SLEARN purchase', async () => {
    hooks.authedGet.mockResolvedValue({
      data: { courses: [{ ...PURCHASE, usdt_amount_paid: '0', transaction_hash: null }] },
    })

    render(<PremiumCoursesSection lang="es" />)

    expect(await screen.findByText(/10\.00 SLEARN/)).toBeInTheDocument()
    expect(screen.queryByText(/USDT/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver transacción' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mis cursos premium' })).toBeInTheDocument()
  })

  it('keeps working when the request fails', async () => {
    hooks.authedGet.mockRejectedValue(new Error('500'))

    const { container } = render(<PremiumCoursesSection lang="en" />)

    await waitFor(() => expect(hooks.authedGet).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
