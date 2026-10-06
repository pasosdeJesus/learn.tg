// @vitest-environment jsdom
// The verifier opens a paid course row and sees the people who bought it
// (GET /api/admin/premium-purchases/[courseId]).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import React from 'react'

const mockAdminFetch = vi.fn()
vi.mock('@/lib/admin-fetch', () => ({
  adminFetch: (...args: any[]) => mockAdminFetch(...args),
  adminAuthParams: () => '',
}))

const { PremiumPurchasesWidget } = await import('@/components/admin/PremiumPurchasesWidget')

const COURSE = { courseId: 7, titulo: 'Global Disciples', purchases: 1, usdt: 1, slearn: 22 }

function mockRoutes(detail: any) {
  mockAdminFetch.mockImplementation((url: string) => {
    if (String(url).includes('/premium-purchases/7')) return Promise.resolve(detail)
    return Promise.resolve({ courses: [COURSE], totals: { purchases: 1, usdt: 1, slearn: 22 } })
  })
}

describe('PremiumPurchasesWidget — enrolled students', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('lists the people enrolled in a paid course when the course is opened', async () => {
    mockRoutes({
      course: { id: 7, titulo: 'Global Disciples' },
      students: [{
        id: 42, nusuario: 'ana', nombre: 'Ana Perez', email: 'ana@x.tg',
        billetera: '0x1234567890abcdef', pais_nombre: 'Sierra Leone',
        usdt_amount_paid: 1, slearn_amount_paid: 22, purchased_at: '2026-01-02T00:00:00Z',
      }],
    })

    await act(async () => { render(React.createElement(PremiumPurchasesWidget, { lang: 'en' })) })
    await waitFor(() => { expect(screen.getByTestId('view-enrolled-7')).toBeTruthy() })

    await act(async () => { fireEvent.click(screen.getByTestId('view-enrolled-7')) })

    await waitFor(() => { expect(screen.getByText('Ana Perez')).toBeTruthy() })
    expect(screen.getByTestId('enrolled-list')).toBeTruthy()
    expect(mockAdminFetch).toHaveBeenCalledWith('/api/admin/premium-purchases/7')
  })

  it('says nobody has purchased the course when the roster is empty', async () => {
    mockRoutes({ course: { id: 7, titulo: 'Global Disciples' }, students: [] })

    await act(async () => { render(React.createElement(PremiumPurchasesWidget, { lang: 'en' })) })
    await waitFor(() => { expect(screen.getByTestId('view-enrolled-7')).toBeTruthy() })

    await act(async () => { fireEvent.click(screen.getByTestId('view-enrolled-7')) })

    await waitFor(() => { expect(screen.getByText('No one has purchased this course yet.')).toBeTruthy() })
  })
})
