// @vitest-environment jsdom
// R-#280: the calendar's delete must go through adminFetch (which appends the
// verifier wallet); a raw fetch went out without it and the API answered 403, so
// the appointment came back after the refresh. It also must confirm success and
// drop the row at once: the CalDAV listing takes ~16 s (one request per event),
// so re-listing right after a delete used to bring the deleted appointment back
// (the service worker served the cached list after its 5 s timeout).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import React from 'react'

const mockAdminFetch = vi.fn()
vi.mock('@/lib/admin-fetch', () => ({
  adminFetch: (...args: any[]) => mockAdminFetch(...args),
  adminAuthParams: () => '',
}))

const mockToast = vi.fn()
vi.mock('@pasosdejesus/m/shadcn-components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

const { CalendarWidget } = await import('@/components/admin/CalendarWidget')

function t(k: string) { return k }

function upcomingEvent(uid: string, summary: string) {
  return {
    uid,
    start: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    summary,
  }
}

describe('CalendarWidget — deleting an appointment (R-#280)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes through adminFetch with the uid (not a raw fetch)', async () => {
    mockAdminFetch.mockResolvedValue({ events: [upcomingEvent('u1', 'Blocked test')] })

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

  it('drops the row and confirms success without re-listing (a stale list would bring it back)', async () => {
    mockAdminFetch.mockResolvedValue({ events: [upcomingEvent('u1', 'Blocked test')] })

    await act(async () => {
      render(React.createElement(CalendarWidget, { lang: 'en', t }))
    })
    await waitFor(() => { expect(screen.getByText('Blocked test')).toBeTruthy() })

    const listCallsBefore = mockAdminFetch.mock.calls.filter(
      (c) => String(c[1]?.method || 'GET').toUpperCase() === 'GET',
    ).length

    await act(async () => {
      fireEvent.click(screen.getByTitle('Delete'))
    })

    await waitFor(() => { expect(screen.queryByText('Blocked test')).toBeNull() })
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'eventDeleted' }))

    const listCallsAfter = mockAdminFetch.mock.calls.filter(
      (c) => String(c[1]?.method || 'GET').toUpperCase() === 'GET',
    ).length
    expect(listCallsAfter).toBe(listCallsBefore)
  })

  it('keeps the row and reports the failure when the delete fails', async () => {
    mockAdminFetch.mockImplementation((url: string, opts?: any) => {
      if (String(opts?.method).toUpperCase() === 'DELETE') {
        return Promise.reject(new Error('Failed to delete event'))
      }
      return Promise.resolve({ events: [upcomingEvent('u1', 'Blocked test')] })
    })

    await act(async () => {
      render(React.createElement(CalendarWidget, { lang: 'en', t }))
    })
    await waitFor(() => { expect(screen.getByText('Blocked test')).toBeTruthy() })

    await act(async () => {
      fireEvent.click(screen.getByTitle('Delete'))
    })

    await waitFor(() => {
      expect(screen.getByText('Failed to delete event')).toBeTruthy()
      expect(screen.getByText('Blocked test')).toBeTruthy()
    })
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'eventDeleteError', variant: 'destructive' }),
    )
  })
})
