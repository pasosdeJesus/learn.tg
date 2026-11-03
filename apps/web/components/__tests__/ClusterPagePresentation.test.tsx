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
  pseudonym: 'Cl2',
  code: 'GL8EZZ',
  country_id: 694,
  created_at: '2026-11-03T03:17:52.510Z',
  initiator_church_id: 171,
  cluster_wallet: null,
  isInitiator: true,
  member_count: 1,
  status: 'pending',
  members: [{ church_id: 171, church_name: 'Cl 1 1', joined_at: '2026-11-03T03:17:52.514Z' }],
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
