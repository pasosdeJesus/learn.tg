// @vitest-environment jsdom
// R-#280: the calendar's delete must go through adminFetch (which appends the
// verifier wallet); a raw fetch went out without it and the API answered 403, so
// the appointment came back after the refresh.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import React from 'react'

const mockAdminFetch = vi.fn()
vi.mock('@/lib/admin-fetch', () => ({
  adminFetch: (...args: any[]) => mockAdminFetch(...args),
  adminAuthParams: () => '',
}))

const { CalendarWidget } = await import('@/components/admin/CalendarWidget')

function t(k: string) { return k }

describe('CalendarWidget — deleting an appointment (R-#280)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes through adminFetch with the uid (not a raw fetch)', async () => {
    const start = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const end = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    mockAdminFetch.mockResolvedValue({
      events: [{ uid: 'u1', start, end, summary: 'Blocked test' }],
    })

    await act(async () => {
      render(React.createElement(CalendarWidget, { lang: 'en', t }))
    })
    await waitFor(() => { expect(screen.getByText('Blocked test')).toBeTruthy() })

    await act(async () => {
      fireEvent.click(screen.getByTitle('Delete'))
    })

    await waitFor(() => {
      const del = mockAdminFetch.mock.calls.find(
        (c) => String(c[1]?.method).toUpperCase() === 'DELETE',
      )
      expect(del).toBeTruthy()
      expect(String(del![0])).toContain('uid=u1')
    })
  })
})
