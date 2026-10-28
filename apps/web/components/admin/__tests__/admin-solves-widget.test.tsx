import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Widget de la cola `admin_solves` en el panel del verificador: sin él las filas que
// insertan las rutas cuando falla el registro del 10% quedaban invisibles (R-#161).
const mockAdminFetch = vi.fn()
vi.mock('@/lib/admin-fetch', () => ({
  adminFetch: (...args: any[]) => mockAdminFetch(...args),
  adminAuthParams: () => '',
}))

import { AdminSolvesWidget } from '../AdminSolvesWidget'

const PENDING = {
  items: [
    { id: '7', type: 'gd_cluster_ledger', metadata: { cluster_id: 3 }, created_at: '2026-10-28T10:00:00Z', solved_at: null, note: null, solved_by: null },
  ],
  counts: [
    { type: 'gd_cluster_ledger', count: '2' },
    { type: 'gd_cluster_transfer', count: '1' },
  ],
  pendingTotal: 3,
  status: 'pending',
  type: null,
}

describe('AdminSolvesWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the pending total, the counts per type and the link to the page', async () => {
    mockAdminFetch.mockResolvedValue(PENDING)
    render(<AdminSolvesWidget lang="en" />)

    await waitFor(() => expect(screen.getByTestId('admin-solves-widget')).toHaveTextContent('(3)'))
    // El tipo aparece en el conteo y en la lista de recientes.
    expect(screen.getAllByText('gd_cluster_ledger').length).toBeGreaterThan(0)
    expect(screen.getAllByText('gd_cluster_transfer').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /See all/i })).toHaveAttribute('href', '/en/admin/solves')
    expect(mockAdminFetch).toHaveBeenCalledWith('/api/admin/solves?status=pending&limit=5')
  })

  it('says there is nothing pending when the queue is empty', async () => {
    mockAdminFetch.mockResolvedValue({ items: [], counts: [], pendingTotal: 0, status: 'pending', type: null })
    render(<AdminSolvesWidget lang="es" />)

    await waitFor(() => expect(screen.getByText(/Nada pendiente/)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /Ver todos/i })).toHaveAttribute('href', '/es/admin/solves')
  })
})
