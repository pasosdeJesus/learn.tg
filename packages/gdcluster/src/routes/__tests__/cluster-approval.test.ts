import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

// Dos fases de aprobación de los pastores (REQ/161 §4.7):
// - `wallet`: con la tercera aprobación el clúster pasa a `wallet_approved` y la
//   billetera queda fija. Después ya no se puede aprobar ni cambiar.
// - `data`: sólo cuando los datos están completos (`waiting_for_pd_job_offer` o
//   `returned`); con la tercera aprobación el clúster pasa a `requested`.

vi.mock('../../lib/cluster-pastors.js', () => ({
  getClusterPastors: vi.fn(async () => [{ usuario_id: 5, church_id: 20 }]),
}))

const state = vi.hoisted(() => ({
  readiness: {
    ready: true,
    cluster_status: 'active',
    member_churches: 3,
    pastors: [],
    missing: [] as string[],
    missing_data: [] as string[],
    request: null as any,
    wallet: '0x84272a6dd0D5fE9ea2Ab28Cf96e72f4F7da00C5C',
    approvals: { pastors: 1, approved: 1, all_approved: true, voters: [5], hash: 'h', phase: 'data' },
    wallet_approvals: { pastors: 1, approved: 1, all_approved: true, voters: [5], hash: 'w', phase: 'wallet' },
  },
  allApproved: true,
}))

vi.mock('../../lib/gd-presentation.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/gd-presentation.js')>()
  return { ...actual, getPresentationReadiness: vi.fn(async () => state.readiness) }
})

// Las aprobaciones ya están completas: aquí se prueba la ruta (la cuenta real de
// aprobaciones se prueba en lib/__tests__/cluster-approvals.test.ts).
vi.mock('../../lib/cluster-approvals.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/cluster-approvals.js')>()
  const build = (phase: 'wallet' | 'data') => ({
    pastors: 3,
    approved: state.allApproved ? 3 : 1,
    all_approved: state.allApproved,
    voters: [5],
    hash: 'hash',
    phase,
  })
  return {
    ...actual,
    getClusterApprovalSummary: vi.fn(async () => ({ wallet: build('wallet'), data: build('data') })),
  }
})

vi.mock('../../lib/cluster-funds.js', () => ({
  readClusterFunds: vi.fn(async () => ({ usdt: 10000000n, slearn: 500n, exists: true, verified: false })),
}))

import { approvePresentation } from '../cluster-approval.js'
import { readClusterFunds } from '../../lib/cluster-funds.js'
import type { GdclusterDeps } from '../../index.js'

const { mockExecuteTakeFirst, mockExecute, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'
const CLUSTER_WALLET = '0x84272a6dd0D5fE9ea2Ab28Cf96e72f4F7da00C5C'

const CLUSTER = {
  id: 3,
  name: 'Esperanza',
  status: 'active',
  initiator_church_id: 20,
  gd_status: 'forming',
  fourth_year_budget: 500,
  budget_draft_path: 'cluster/3/budget.pdf',
  director_offer_path: 'cluster/3/director.pdf',
  director_first_year_pay: 180,
  director_first_year_hours: 320,
  budget_fixed_at: null,
  director_fixed_at: null,
}

function buildDeps(): any {
  return {
    db: () => new apiDbMocks.MockKysely(),
    authenticateUser: vi.fn().mockResolvedValue({
      usuario: { id: 5, church_id: 20, nombre: 'Pastor A', church_relationship: 'pastor' },
      billetera: { billetera: WALLET },
    }),
    backend: {
      getPublicClient: () => ({ readContract: vi.fn().mockResolvedValue([0n, 0n, true, true]) }),
    },
  }
}

function post(url: string, body: any): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) })
}

function approve(phase: 'wallet' | 'data') {
  return approvePresentation(
    buildDeps() as GdclusterDeps,
    post(`/api/cluster/3/approval?phase=${phase}`, { walletAddress: WALLET, phase }),
    { id: '3' },
  )
}

describe('approvePresentation — phase wallet (R-#161 §4.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    state.allApproved = true
  })

  it('moves the cluster to wallet_approved with the third approval', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ ...CLUSTER }) // clustergd
      .mockResolvedValueOnce({ cluster_wallet: CLUSTER_WALLET }) // iglesia iniciadora
      .mockResolvedValueOnce({ numUpdatedRows: 1n }) // update a wallet_approved
      .mockResolvedValueOnce({ gd_status: 'wallet_approved' }) // estado final
    mockExecute.mockResolvedValue([])

    const res = await approve('wallet')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.phase).toBe('wallet')
    expect(json.status).toBe('wallet_approved')
    expect(json.wallet_approvals.all_approved).toBe(true)
  })

  it('refuses a wallet approval once the wallet is fixed', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ ...CLUSTER, gd_status: 'wallet_approved' })

    const res = await approve('wallet')
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('wallet_approval_closed')
  })
})

describe('approvePresentation — phase data (R-#161 §4.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    state.allApproved = true
  })

  it('turns the third data approval into the request to pdJ', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ ...CLUSTER, gd_status: 'waiting_for_pd_job_offer' }) // clustergd
      .mockResolvedValueOnce({ cluster_wallet: CLUSTER_WALLET }) // billetera (requestBlocker)
      .mockResolvedValueOnce({ cluster_wallet: CLUSTER_WALLET }) // billetera otra vez (requestBlocker)
      .mockResolvedValueOnce({ numUpdatedRows: 1n }) // update a requested
      .mockResolvedValueOnce({ gd_status: 'requested' }) // estado final
    mockExecute.mockResolvedValue([])

    const res = await approve('data')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.phase).toBe('data')
    expect(json.status).toBe('requested')
  })

  it('refuses the data approval before the wallet is approved and the data are complete', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ ...CLUSTER, gd_status: 'forming' })

    const res = await approve('data')
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('data_approval_not_open')
  })

  it('keeps the approval but refuses the request when the fund has no money', async () => {
    ;(readClusterFunds as any).mockResolvedValueOnce({ usdt: 0n, slearn: 0n, exists: true, verified: false })
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ ...CLUSTER, gd_status: 'waiting_for_pd_job_offer' }) // clustergd
      .mockResolvedValueOnce({ cluster_wallet: CLUSTER_WALLET }) // billetera (requestBlocker)
      .mockResolvedValueOnce({ cluster_wallet: CLUSTER_WALLET }) // billetera otra vez (requestBlocker)
    mockExecute.mockResolvedValue([])

    const res = await approve('data')
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('cluster_fund_empty')
  })
})
