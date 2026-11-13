import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ClusterPage } from '@learn-tg/gdcluster/components/ClusterPage'

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

const Button = ({ children, ...rest }: any) => <button {...rest}>{children}</button>

const cluster = {
  id: 52,
  name: 'Cl2',
  slug: 'cl2',
  country_id: 694,
  created_at: '2026-11-03T03:17:52.510Z',
  initiator_church_id: 171,
  cluster_wallet: null,
  isInitiator: true,
  member_count: 3,
  status: 'pending',
  // El panel de presupuesto/oferta se pinta a partir de 3 iglesias (R-#161:
  // presentar exige 3); con una sola el bloque de datos faltantes no aparece.
  members: [
    { church_id: 171, church_name: 'Cl 1 1', joined_at: '2026-11-03T03:17:52.514Z' },
    { church_id: 172, church_name: 'Cl 2 2', joined_at: '2026-11-03T03:17:52.514Z' },
    { church_id: 173, church_name: 'Cl 3 3', joined_at: '2026-11-03T03:17:52.514Z' },
  ],
  history: [{ event_type: 'church_join', old_value: null, new_value: 'Cl 1 1', changed_by: 1166, created_at: '2026-11-03T03:17:52.518Z' }],
}

const presentation = {
  ready: false,
  cluster_status: 'pending',
  member_churches: 1,
  pastors: [],
  missing: ['cluster_active'],
  missing_data: ['budget_total', 'budget_pdf', 'director_offer_pdf', 'director_pay', 'director_hours'],
  wallet: null,
  approvals: { pastors: 0, approved: 0, all_approved: false, voters: [] },
  request: null,
  isInitiator: true,
  isMember: true,
  can_approve: false,
}

const address = '0x84272a6dd0D5fE9ea2Ab28Cf96e72f4F7da00C5C'

const deps = {
  useAuthAddress: () => ({ address }),
  useSession: () => ({ data: { address } }),
  getCsrfToken: async () => 'csrf',
  Button,
}

describe('ClusterPage with an incomplete presentation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input)
        if (url.includes('/gd-presentation')) {
          return { ok: true, json: async () => presentation } as any
        }
        return { ok: true, json: async () => cluster } as any
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the missing data list instead of crashing', async () => {
    render(<ClusterPage lang="en" id="52" deps={deps} />)

    await waitFor(() => {
      expect(screen.getByText('Before requesting the presentation you must complete:')).toBeInTheDocument()
    })
    expect(screen.getByText('the total for the first year')).toBeInTheDocument()
    expect(screen.getByText('the expected hours for the first year')).toBeInTheDocument()
    expect(screen.queryByText('A wallet connection error occurred. Please try:')).not.toBeInTheDocument()
  })

  it('renders the same block in Spanish', async () => {
    render(<ClusterPage lang="es" id="52" deps={deps} />)

    await waitFor(() => {
      expect(screen.getByText('Antes de solicitar la presentación debes completar:')).toBeInTheDocument()
    })
  })
})
