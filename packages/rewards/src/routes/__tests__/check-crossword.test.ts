// Engine tests for the crossword submission (F-#295).
//
// The route is exercised through injected deps: a fake database, a fake vault
// contract and a `submitScholarship` the test can make hang. That is what was
// missing when the submission stayed on "Sending..." forever after the guide had
// already been credited.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { checkCrosswordPost } from '../check-crossword.js'

const WALLET = '0x1111111111111111111111111111111111111111'
const TX_HASH = '0x2222222222222222222222222222222222222222222222222222222222222222'
const VAULT = '0x3333333333333333333333333333333333333333'

interface FakeOptions {
  guides?: Array<{ id: number; nombrecorto: string; sufijoRuta: string }>
  completed?: number
  courseFlags?: Record<string, unknown> | null
  recorded?: Array<{ crypto: string; metadata: { guideId?: number }; wallet?: string }>
}

/**
 * Minimal fake Kysely: every builder records its table and answers by table
 * name, which keeps the route's many queries readable in the expectations.
 */
function createFakeDb(options: FakeOptions = {}) {
  const state = {
    guideCredits: 0,
    transactions: [] as Array<Record<string, any>>,
  }
  const guides = options.guides ?? [
    { id: 101, nombrecorto: 'guide1', sufijoRuta: 'guide1' },
    { id: 102, nombrecorto: 'guide2', sufijoRuta: 'guide2' },
  ]
  const courseFlags =
    options.courseFlags === undefined
      ? { contenido_sensible: false, mostrar_cursos_publico: true, mostrar_cursos_sensibles_publico: false }
      : options.courseFlags

  function terminal(method: string, table: string): any {
    if (method === 'execute') {
      if (table === 'transaction') return Promise.resolve(options.recorded ?? [])
      return Promise.resolve([])
    }
    if (method === 'executeTakeFirst') {
      if (table === 'cor1440_gen_proyectofinanciero as c') return Promise.resolve(courseFlags)
      if (table === 'guide_usuario') return Promise.resolve({ count: options.completed ?? 1 })
      return Promise.resolve(null)
    }
    // executeTakeFirstOrThrow
    if (table === 'guide_usuario') {
      return Promise.resolve({ usuario_id: 7, actividadpf_id: 101, points: 1, amountpaid: 0 })
    }
    return Promise.resolve({})
  }

  function builder(table: string): any {
    const chain: any = {
      select: () => chain,
      selectAll: () => chain,
      where: () => chain,
      leftJoin: () => chain,
      innerJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      values: (row: any) => {
        if (table === 'guide_usuario') state.guideCredits += 1
        if (table === 'transaction') state.transactions.push(row)
        return chain
      },
      set: () => {
        if (table === 'guide_usuario') state.guideCredits += 1
        return chain
      },
      returningAll: () => chain,
      onConflict: (cb?: any) => {
        if (cb) cb(chain)
        return chain
      },
      doNothing: () => chain,
      execute: () => terminal('execute', table),
      executeTakeFirst: () => terminal('executeTakeFirst', table),
      executeTakeFirstOrThrow: () => terminal('executeTakeFirstOrThrow', table),
    }
    return chain
  }

  const db: any = {
    selectFrom: (table: string) => builder(table),
    insertInto: (table: string) => builder(table),
    updateTable: (table: string) => builder(table),
    deleteFrom: (table: string) => builder(table),
    transaction: () => ({ execute: async (cb: any) => cb(db) }),
    // `sql\`...\`.execute(db)` goes through `db.getExecutor().executeQuery`.
    getExecutor: () => ({
      transformQuery: (node: any) => node,
      compileQuery: (node: any) => node,
      executeQuery: async () => ({ rows: guides }),
    }),
    executeQuery: async () => ({ rows: guides }),
    fn: { countAll: () => ({ as: () => 'count' }) },
  }

  return { db, state }
}

interface FakeVaultOptions {
  paidAfter?: bigint[]
}

/**
 * Fake vault that behaves like `LearnTGVaultsV5.payScholarship`: a non-perfect
 * submission moves no tokens (`!isPerfect` returns early in the contract).
 */
function createFakeVault(options: FakeVaultOptions = {}) {
  const paidAfter = options.paidAfter ?? [1_000_000n, 200n]
  let paid = false
  return {
    read: {
      vaults: vi.fn(async () => [10n, 1_000_000_000n, 1_000_000n, 10_000_000n, 20_000n, true]),
      studentCanSubmit: vi.fn(async () => true),
      studentCooldowns: vi.fn(async () => 0n),
      getStudentGuideStatus: vi.fn(async () => (paid ? paidAfter : [0n, 0n])),
    },
    write: { payScholarship: vi.fn() },
    pay(isPerfect: boolean) {
      if (isPerfect) paid = true
    },
  }
}

function buildRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/check-crossword', {
    method: 'POST',
    body: JSON.stringify({
      courseId: 10,
      guideId: 1,
      lang: 'en',
      walletAddress: WALLET,
      grid: [[{ userInput: 'H' }, { userInput: 'E' }, { userInput: 'L' }, { userInput: 'L' }, { userInput: 'O' }]],
      placements: [{ word: 'HELLO', row: 0, col: 0, direction: 'across', number: 1, clue: 'greeting' }],
      ...body,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildDeps(overrides: { db?: any; vault?: any; submitScholarship?: any; timeoutMs?: number } = {}) {
  const fake = overrides.db ?? createFakeDb()
  const vault = overrides.vault ?? createFakeVault()
  const submitScholarship =
    overrides.submitScholarship ??
    vi.fn(async ({ callArgs }: { callArgs: any[] }) => {
      vault.pay?.(Boolean(callArgs[3]))
      return TX_HASH
    })
  const deps: any = {
    db: () => fake.db,
    authenticateUser: vi.fn(async () => ({
      usuario: { id: 7, profilescore: 100 },
      billetera: { usuario_id: 7, answer_fib: 'HELLO' },
    })),
    recordEvent: vi.fn(async () => {}),
    updateUserAndCoursePoints: vi.fn(async () => 1),
    routeReward: vi.fn(async () => {}),
    routeToClusterFunds: vi.fn(async () => ({})),
    canPurchasePremiumCourse: vi.fn(async () => ({ access: true })),
    crosswordChain: {
      publicClient: {},
      walletClient: {},
      account: { address: WALLET },
      getActiveVault: async () => ({ address: VAULT, version: 'V5' }),
      getVaultContract: () => vault,
      submitScholarship,
      timeoutMs: overrides.timeoutMs ?? 200,
    },
  }
  return { deps, state: fake.state, vault, submitScholarship }
}

describe('checkCrosswordPost — scholarship section (engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('pays the scholarship and reports the amounts when the chain answers', async () => {
    const { deps, state, submitScholarship } = buildDeps()

    const res = await checkCrosswordPost(deps, buildRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.mistakesInCW).toEqual([])
    expect(json.points).toBe(1)
    expect(json.scholarship).toBe('paid')
    expect(json.scholarshipUsdt).toBe(1)
    expect(json.scholarshipSlearn).toBe(2)
    expect(submitScholarship).toHaveBeenCalledTimes(1)
    expect(state.transactions.map((row) => row.crypto)).toEqual(['usdt', 'slearn'])
    expect(json.message).toContain('You received 1.00 USDT')
  })

  it('answers within the deadline with the guide credited and the scholarship pending when the chain hangs', async () => {
    const hanging = vi.fn(() => new Promise<never>(() => {}))
    const { deps, state } = buildDeps({ submitScholarship: hanging, timeoutMs: 50 })
    const started = Date.now()

    const res = await checkCrosswordPost(deps, buildRequest())
    const elapsed = Date.now() - started
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(elapsed).toBeLessThan(2000)
    expect(json.points).toBe(1)
    expect(json.scholarship).toBe('pending')
    expect(json.scholarshipUsdt).toBe(0)
    expect(state.guideCredits).toBeGreaterThan(0)
    expect(state.transactions).toEqual([])
    expect(json.message).toContain('will be retried automatically')
    expect(deps.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'scholarship_pending',
        event_data: expect.objectContaining({ courseId: 10, guideId: 101, reason: 'scholarship_timeout' }),
      }),
    )
  })

  it('reports a pending scholarship when the vault read fails', async () => {
    const failing = {
      read: {
        vaults: vi.fn(async () => {
          throw new Error('RPC unavailable')
        }),
      },
      write: { payScholarship: vi.fn() },
    }
    const { deps } = buildDeps({ vault: failing })

    const res = await checkCrosswordPost(deps, buildRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.scholarship).toBe('pending')
    expect(json.points).toBe(1)
    expect(deps.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'scholarship_pending',
        event_data: expect.objectContaining({ reason: 'scholarship_failed' }),
      }),
    )
  })

  it('does not credit nor pay when the answer is wrong', async () => {
    const grid = [[{ userInput: 'H' }, { userInput: 'X' }, { userInput: 'L' }, { userInput: 'L' }, { userInput: 'O' }]]
    const { deps, state } = buildDeps()

    const res = await checkCrosswordPost(deps, buildRequest({ grid }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.mistakesInCW).toEqual([1])
    expect(json.points).toBe(0)
    expect(json.scholarship).toBe('not_paid')
    expect(state.guideCredits).toBe(0)
    expect(state.transactions).toEqual([])
    expect(deps.updateUserAndCoursePoints).not.toHaveBeenCalled()
  })
})
