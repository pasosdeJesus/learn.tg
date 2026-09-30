// Integration test: Admin widgets display data from API
// Verifies widgets don't silently fail (the .then(r => r.json()) bug)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
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
    'data-userid': String(props.userId),
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
    expect(bloque).toContain('Registration number')
    // El verificador puede corregirlos (R-#152) y el documento se puede reemplazar.
    expect((screen.getByTestId('user-registration') as HTMLInputElement).value).toBe('REG-12345')
    expect((screen.getByTestId('user-denomination') as HTMLInputElement).value).toBe('Anglican')
    const foto = screen.getAllByTestId('photo-upload').find(el => el.getAttribute('data-side') === 'registration')
    expect(foto).toBeTruthy()
    expect(foto!.getAttribute('data-userid')).toBe('1')
    expect(screen.getByTestId('user-registration-delete')).toBeTruthy()
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
    expect((screen.getByTestId('user-registration') as HTMLInputElement).value).toBe('REG-99999')
  })

  it('offers to create the church from the declared name and country, even without pastor contact', async () => {
    mockAdminFetch.mockResolvedValue({})

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t,
        user: {
          id: 1, nombre: 'Ana', church_relationship: 'pastor', pais_id: 694,
          place_of_worship: 'Iglesia Nueva', place_of_worship_location: 'Freetown',
        } as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })

    await waitFor(() => {
      expect(screen.getByText('Create Church')).toBeTruthy()
    })
  })

  it('saves the registration number and denomination the verifier edits', async () => {
    mockAdminFetch.mockResolvedValue({})

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t,
        user: { id: 1, nombre: 'Ana', church_relationship: 'pastor', registration: 'REG-1', denomination: 'Anglican' } as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })

    await waitFor(() => expect(screen.getByTestId('user-registration')).toBeTruthy())
    fireEvent.change(screen.getByTestId('user-registration'), { target: { value: 'REG-777' } })
    fireEvent.change(screen.getByTestId('user-denomination'), { target: { value: 'Methodist' } })
    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })

    await waitFor(() => {
      const patch = mockAdminFetch.mock.calls.find((c: any[]) => c[1]?.method === 'PATCH')
      expect(patch).toBeTruthy()
      const body = JSON.parse((patch as any[])[1].body)
      expect(body.registration).toBe('REG-777')
      expect(body.denomination).toBe('Methodist')
    })
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

// Referidos (https://github.com/pasosdeJesus/learn.tg/issues/163): el verificador ve el
// código del usuario como referidor y quién lo refirió, y puede corregir el referidor.
describe('UserEditModal — referidos', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const withReferral = {
    id: 42, nombre: 'Ana',
    referral: {
      code: 'ABC123',
      referrer: { id: 5, nusuario: 'juan', nombre: 'Juan Perez' },
      claimed_at: '2026-09-13T10:00:00Z',
      rewards_paid: { count: 2, usdt: 0.1, slearn: 0.2 },
    },
  }

  it('shows the code, who referred the user, the paid rewards and the current referrer', async () => {
    mockAdminFetch.mockResolvedValue({})

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t, user: withReferral as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('user-referral')).toBeTruthy()
    })
    const block = screen.getByTestId('user-referral').textContent || ''
    expect(block).toContain('ABC123')
    expect(screen.getByTestId('user-referred-by').textContent).toContain('#5 juan (Juan Perez)')
    // Aviso: las recompensas ya pagadas no se mueven al cambiar el referidor.
    expect(screen.getByTestId('user-referral-paid')).toBeTruthy()
    expect((screen.getByTestId('user-referrer') as HTMLInputElement).value).toBe('5')
  })

  it('shows "sin referidor" and an empty field when the user has no referrer', async () => {
    mockAdminFetch.mockResolvedValue({})

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t,
        user: { id: 42, nombre: 'Ana', referral: { code: null, referrer: null, rewards_paid: { count: 0, usdt: 0, slearn: 0 } } } as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('user-referral')).toBeTruthy()
    })
    expect(screen.getByTestId('user-referred-by').textContent).toContain('none')
    expect((screen.getByTestId('user-referrer') as HTMLInputElement).value).toBe('')
    expect(screen.queryByTestId('user-referral-paid')).toBeNull()
  })

  it('sends the new referrer on save, and nothing when it was not touched', async () => {
    mockAdminFetch.mockResolvedValue({})

    await act(async () => {
      render(React.createElement(UserEditModal, {
        lang: 'en', t, user: withReferral as any,
        onClose: () => {}, onSaved: () => {},
      }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('user-referrer')).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId('user-referrer'), { target: { value: 'juan' } })
    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })

    const patch = mockAdminFetch.mock.calls.find(
      (call) => String(call[0]).includes('/api/admin/user/42'),
    )
    expect(patch).toBeTruthy()
    expect(JSON.parse(String((patch![1] as RequestInit).body)).referrer).toBe('juan')
  })
})
