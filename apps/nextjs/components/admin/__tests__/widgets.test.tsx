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
vi.mock('@/components/shared/ChurchSelector', () => ({ ChurchSelector: () => null }))
vi.mock('@/components/shared/PhotoUpload', () => ({
  PhotoUpload: (props: any) => React.createElement('span', {
    'data-testid': 'photo-upload',
    'data-side': props.side,
    'data-readonly': String(!!props.readOnly),
  }),
}))

// Import widgets after mocks
const { PendingWidget, RecentUsersWidget, RecentChurchesWidget, UserEditModal } = await import('@/components/admin/AdminWidgets')

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

describe('UserEditModal — church data depends on whether the church is registered', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows the pastor name and WhatsApp while the church is not registered', async () => {
    mockAdminFetch.mockResolvedValue({})

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t,
        user: { id: 1, nombre: 'Ana', church_id: null, pastor_name: 'Pastor Juan', pastor_whatsapp: '+23276123456' } as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('user-pastor-info')).toBeTruthy()
    })
    const pastor = screen.getByTestId('user-pastor-info').textContent || ''
    expect(pastor).toContain('Pastor Juan')
    expect(pastor).toContain('+23276123456')
    expect(screen.queryByTestId('user-church-registered')).toBeNull()
    // La ciudad y el nombre declarados siguen visibles y editables.
    expect(screen.getByText('City of Place of Worship')).toBeTruthy()
    expect(screen.getByPlaceholderText('Church/mosque name...')).toBeTruthy()
  })

  it('shows the registered church name and location and hides the declared data and the pastor', async () => {
    mockAdminFetch.mockImplementation((url: string) =>
      Promise.resolve(String(url).includes('/api/admin/church/7')
        ? { id: 7, name: 'Iglesia Registrada', city_name: 'Freetown', country_name: 'Sierra Leone' }
        : {}))

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t,
        user: {
          id: 1, nombre: 'Ana', church_id: 7,
          pastor_name: 'Pastor Juan', pastor_whatsapp: '+23276123456',
          place_of_worship: 'Iglesia Declarada', place_of_worship_location: 'Bo',
        } as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('user-church-registered')).toBeTruthy()
    })
    const iglesia = screen.getByTestId('user-church-registered').textContent || ''
    expect(iglesia).toContain('Iglesia Registrada')
    expect(iglesia).toContain('Freetown')
    expect(iglesia).toContain('Sierra Leone')
    // Ni la declaración del usuario ni el contacto del pastor.
    expect(screen.queryByTestId('user-pastor-info')).toBeNull()
    expect(screen.queryByPlaceholderText('Church/mosque name...')).toBeNull()
    expect(screen.queryByText('City of Place of Worship')).toBeNull()
    expect(document.body.textContent || '').not.toContain('Pastor Juan')
    expect(document.body.textContent || '').not.toContain('Iglesia Declarada')
  })

  it('shows the church registration number and document when the user is a pastor', async () => {
    mockAdminFetch.mockResolvedValue({})

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t,
        user: {
          id: 1, nombre: 'Ana', church_relationship: 'pastor',
          registration: 'REG-12345', registration_photo: 'user/1/id_registration.jpg',
          denomination: 'Anglican',
        } as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('user-pastor-registration')).toBeTruthy()
    })
    const bloque = screen.getByTestId('user-pastor-registration').textContent || ''
    expect(bloque).toContain('REG-12345')
    expect(bloque).toContain('Anglican')
    // El documento se muestra en solo lectura (el pastor lo declara, no el verificador).
    const foto = screen.getAllByTestId('photo-upload').find(el => el.getAttribute('data-side') === 'registration')
    expect(foto).toBeTruthy()
    expect(foto!.getAttribute('data-readonly')).toBe('true')
  })

  it('shows the church registration block for a co-pastor too', async () => {
    mockAdminFetch.mockResolvedValue({})

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t,
        user: {
          id: 1, nombre: 'Ana', church_relationship: 'co_pastor',
          registration: 'REG-99999', registration_photo: 'user/1/id_registration.jpg',
        } as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('user-pastor-registration')).toBeTruthy()
    })
    expect(screen.getByTestId('user-pastor-registration').textContent || '').toContain('REG-99999')
  })

  it('hides the church registration block when the user is not a pastor', async () => {
    mockAdminFetch.mockResolvedValue({})

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t,
        user: {
          id: 1, nombre: 'Ana', church_relationship: 'member',
          registration: 'REG-12345', registration_photo: 'user/1/id_registration.jpg',
        } as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })

    await waitFor(() => {
      expect(screen.queryByTestId('user-pastor-registration')).toBeNull()
    })
    // Sigue habiendo fotos de identidad (frontal/reverso), pero ninguna de registro.
    const registro = screen.queryAllByTestId('photo-upload').filter(el => el.getAttribute('data-side') === 'registration')
    expect(registro).toHaveLength(0)
  })
})
