import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'

// La contabilidad comercial de cursos de pago se movió del panel público de
// transparencia al de administración (2026-09-21): el widget solo lo ven
// verificadores, y su API (`GET /api/admin/premium-purchases`) exige
// `authenticateAdmin`. Ver https://github.com/pasosdeJesus/learn.tg/issues/128.
const adminFetchMock = vi.hoisted(() => ({ adminFetch: vi.fn() }))

vi.mock('@/lib/admin-fetch', () => adminFetchMock)

import { PremiumPurchasesWidget } from '../admin/PremiumPurchasesWidget'

const PAYLOAD = {
  courses: [
    { courseId: 10, titulo: 'Global Disciples', purchases: 3, usdt: 3.3, slearn: 30 },
    { courseId: 11, titulo: null, purchases: 1, usdt: 0, slearn: 22 },
  ],
  totals: { purchases: 4, usdt: 3.3, slearn: 52 },
}

describe('PremiumPurchasesWidget', () => {
  beforeEach(() => {
    adminFetchMock.adminFetch.mockReset()
    adminFetchMock.adminFetch.mockResolvedValue(PAYLOAD)
  })

  it('lists the per-course purchases with the totals', async () => {
    render(<PremiumPurchasesWidget lang="en" />)

    expect(await screen.findByText('Global Disciples')).toBeInTheDocument()
    expect(screen.getByText(/Premium purchases/)).toBeInTheDocument()
    expect(adminFetchMock.adminFetch).toHaveBeenCalledWith('/api/admin/premium-purchases')
    // curso sin título: se identifica por id
    expect(screen.getByText('#11')).toBeInTheDocument()
    // fila de totales
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('52.00')).toBeInTheDocument()
  })

  it('answers in Spanish when the page language is es', async () => {
    render(<PremiumPurchasesWidget lang="es" />)

    expect(await screen.findByText(/Compras premium/)).toBeInTheDocument()
    expect(screen.getByText('Curso')).toBeInTheDocument()
  })

  it('shows the empty state when there is nothing to show', async () => {
    adminFetchMock.adminFetch.mockResolvedValue({ courses: [], totals: { purchases: 0, usdt: 0, slearn: 0 } })

    render(<PremiumPurchasesWidget lang="en" />)

    expect(await screen.findByText('No purchases yet')).toBeInTheDocument()
  })

  it('keeps the card (no crash) when the request fails', async () => {
    adminFetchMock.adminFetch.mockRejectedValue(new Error('401'))

    render(<PremiumPurchasesWidget lang="en" />)

    await waitFor(() => expect(adminFetchMock.adminFetch).toHaveBeenCalled())
    expect(screen.getByTestId('premium-purchases')).toBeInTheDocument()
    expect(screen.getByText('No purchases yet')).toBeInTheDocument()
  })
})
