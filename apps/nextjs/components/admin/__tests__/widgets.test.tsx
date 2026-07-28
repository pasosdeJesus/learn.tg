// Integration test: Admin widgets display data from API
// Verifies widgets don't silently fail (the .then(r => r.json()) bug)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import React from 'react'

// Mock adminFetch to return data directly (as it does in production — returns parsed JSON)
const mockAdminFetch = vi.fn()
vi.mock('@/lib/admin-fetch', () => ({
  adminFetch: (...args: any[]) => mockAdminFetch(...args),
  adminAuthParams: () => '',
}))

// Mock components that the widgets use but aren't under test
vi.mock('@/components/shared/FormSelects', () => ({
  CountrySelect: () => null,
  ReligionSelect: () => null,
  ChurchRoleSelect: () => null,
}))
vi.mock('@/components/shared/TownAutocomplete', () => ({
  TownAutocomplete: () => null,
}))
vi.mock('@/components/admin/Modal', () => ({
  Modal: ({ children }: any) => React.createElement('div', null, children),
  InputField: () => null,
}))

// Import widgets after mocks
const { PendingWidget, RecentUsersWidget, RecentChurchesWidget } = await import('@/components/admin/AdminWidgets')

function t(k: string) { return k }

describe('Admin Widgets — data display', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('PendingWidget shows users when API returns data', async () => {
    mockAdminFetch.mockResolvedValueOnce({
      users: [{ id: 1, nombre: 'Test User', billetera: '0x1234567890abcdef', proposed_date_of_interview: '2026-08-01T00:00:00Z' }],
    })

    await act(async () => {
      render(React.createElement(PendingWidget, { lang: 'en', t }))
    })

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeTruthy()
    })
  })

  it('PendingWidget shows "No pending" when API returns empty', async () => {
    mockAdminFetch.mockResolvedValueOnce({ users: [] })

    await act(async () => {
      render(React.createElement(PendingWidget, { lang: 'en', t }))
    })

    await waitFor(() => {
      expect(screen.getByText('noPending')).toBeTruthy()
    })
  })

  it('PendingWidget handles API error gracefully', async () => {
    mockAdminFetch.mockRejectedValueOnce(new Error('Access denied'))

    await act(async () => {
      render(React.createElement(PendingWidget, { lang: 'en', t }))
    })

    // Should not crash — just show empty state or loading
    await waitFor(() => {
      const body = document.body.textContent || ''
      expect(body.length).toBeGreaterThan(0)
    })
  })

  it('RecentUsersWidget shows users when API returns data', async () => {
    mockAdminFetch.mockResolvedValueOnce({
      users: [{ id: 1, nombre: 'Alice', billetera: '0xaaa', paises_nombre: 'Colombia', profilescore: 50, created_at: new Date().toISOString() }],
    })

    await act(async () => {
      render(React.createElement(RecentUsersWidget, { lang: 'en', t }))
    })

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy()
    })
  })

  it('RecentChurchesWidget shows churches when API returns data', async () => {
    mockAdminFetch.mockResolvedValueOnce({
      churches: [{ id: 1, name: 'Iglesia Test', pastor_name: 'Pastor Juan', created_at: new Date().toISOString() }],
    })

    await act(async () => {
      render(React.createElement(RecentChurchesWidget, { lang: 'en', t }))
    })

    await waitFor(() => {
      expect(screen.getByText('Iglesia Test')).toBeTruthy()
    })
  })

  it('adminFetch is called only once per widget (no refetch loop)', async () => {
    mockAdminFetch.mockResolvedValue({ users: [] })

    await act(async () => {
      render(React.createElement(PendingWidget, { lang: 'en', t }))
    })

    await waitFor(() => {
      expect(mockAdminFetch).toHaveBeenCalledTimes(1)
    })
  })
})
