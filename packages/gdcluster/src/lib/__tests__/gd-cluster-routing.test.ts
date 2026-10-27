import { describe, it, expect, vi } from 'vitest'
import { resolveGDClusterDestination, isGDCourse, recordClusterContribution } from '../gd-cluster-routing.js'

function mockDb(overrides: Record<string, any> = {}) {
  const db = {
    selectFrom: vi.fn((table: string) => {
      if (table === 'church') {
        return {
          innerJoin: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(overrides.churchResult ?? null),
        }
      }
      if (table === 'usuario') {
        return {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(overrides.usuarioResult ?? null),
        }
      }
      if (table === 'msip_pais') {
        return {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(overrides.paisResult ?? null),
        }
      }
      return { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), executeTakeFirst: vi.fn().mockResolvedValue(null) }
    }),
  } as any

  return db
}

describe('isGDCourse', () => {
  it('should return true for GD course IDs', () => {
    expect(isGDCourse(10)).toBe(true)
    expect(isGDCourse(11)).toBe(true)
  })

  it('should return false for non-GD course IDs', () => {
    expect(isGDCourse(1)).toBe(false)
    expect(isGDCourse(2)).toBe(false)
    expect(isGDCourse(102)).toBe(false)
    expect(isGDCourse(103)).toBe(false)
  })
})

describe('resolveGDClusterDestination', () => {
  it('should resolve to cluster when church has cluster_wallet and is in a clustergd', async () => {
    const db = mockDb({
      churchResult: { cluster_wallet: '0xABCD', country_id: 170 },
    })

    const result = await resolveGDClusterDestination(db, 1)
    expect(result.type).toBe('cluster')
    expect(result.destination).toBe('0xABCD')
  })

  it('should resolve to country when no church cluster and country is type 1', async () => {
    const db = mockDb({
      churchResult: null,
      usuarioResult: { pais_id: 170 }, // Colombia
      paisResult: { alfa2: 'CO', tipo_region: 1 },
    })

    const result = await resolveGDClusterDestination(db, 1)
    expect(result.type).toBe('country')
    expect(result.destination).toBe('CO')
  })

  it('should resolve to Sierra Leone when no church and country is not type 1', async () => {
    const db = mockDb({
      churchResult: null,
      usuarioResult: { pais_id: 999 },
      paisResult: { alfa2: 'US', tipo_region: 2 },
    })

    const result = await resolveGDClusterDestination(db, 1)
    expect(result.type).toBe('sierra_leone')
    expect(result.destination).toBe('SL')
  })

  it('should resolve to country when church has no cluster_wallet but country is type 1', async () => {
    const db = mockDb({
      churchResult: { cluster_wallet: null, country_id: 170 },
      usuarioResult: { pais_id: 170 },
      paisResult: { alfa2: 'CO', tipo_region: 1 },
    })

    const result = await resolveGDClusterDestination(db, 1)
    expect(result.type).toBe('country')
    expect(result.destination).toBe('CO')
  })

  it('should resolve to Sierra Leone when church has no cluster_wallet and country is unclassified', async () => {
    const db = mockDb({
      churchResult: { cluster_wallet: null, country_id: 170 },
      usuarioResult: { pais_id: 170 },
      paisResult: { alfa2: 'CO', tipo_region: null },
    })

    const result = await resolveGDClusterDestination(db, 1)
    expect(result.type).toBe('sierra_leone')
    expect(result.destination).toBe('SL')
  })
})

// Ledger del 10% GD (`transaction.type = 'cluster_contribution'`,
// https://github.com/pasosdeJesus/learn.tg/issues/161 — decisión 2026-10-26).
function ledgerDb(numInsertedRows = 1) {
  const rows: any[] = []
  const db = {
    insertInto: vi.fn((table: string) => ({
      values: vi.fn((values: any) => {
        rows.push({ table, values })
        return {
          onConflict: vi.fn(() => ({
            executeTakeFirst: vi.fn().mockResolvedValue({ numInsertedRows }),
          })),
        }
      }),
    })),
  } as any
  return { db, rows }
}

const baseCtx = {
  usuarioId: 7,
  wallet: '0x1234567890abcdef1234567890abcdef12345678',
  source: 'course' as const,
  courseId: 10,
  usdtDecimals: 6,
  slearnDecimals: 2,
}

describe('recordClusterContribution', () => {
  it('inserts one row per token with the real transfer hash', async () => {
    const { db, rows } = ledgerDb()
    const inserted = await recordClusterContribution(
      { ...baseCtx, db },
      { type: 'cluster', destination: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
      {
        usdtAmount: 250000n,
        slearnAmount: 100n,
        usdtHash: '0xusdt',
        slearnHash: '0xslearn',
      },
    )

    expect(inserted).toBe(2)
    expect(rows.map((r) => r.table)).toEqual(['transaction', 'transaction'])
    const [usdt, slearn] = rows.map((r) => r.values)
    expect(usdt).toMatchObject({
      usuario_id: 7,
      type: 'cluster_contribution',
      crypto: 'usdt',
      amount: 0.25,
      balance_impact: 0,
      categoria: 'cluster',
      subcategoria: 'cluster',
      hash: '0xusdt',
      wallet: '0x1234567890abcdef1234567890abcdef12345678',
    })
    expect(JSON.parse(usdt.metadata)).toEqual({
      clusterWallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      source: 'course',
      courseId: 10,
    })
    expect(slearn).toMatchObject({
      crypto: 'slearn',
      amount: 1,
      hash: '0xslearn',
    })
  })

  it('records the country destination with countryCode metadata and guideId', async () => {
    const { db, rows } = ledgerDb()
    await recordClusterContribution(
      { ...baseCtx, db, source: 'guide', guideId: 22 },
      { type: 'country', destination: 'SL' },
      { usdtAmount: 0n, slearnAmount: 4400n, slearnHash: '0xguia' },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].values).toMatchObject({
      crypto: 'slearn',
      amount: 44,
      categoria: 'country',
      subcategoria: 'country',
      hash: '0xguia',
    })
    expect(JSON.parse(rows[0].values.metadata)).toEqual({
      countryCode: 'SL',
      source: 'guide',
      courseId: 10,
      guideId: 22,
    })
  })

  it('skips a token without a confirmed transfer hash', async () => {
    const { db, rows } = ledgerDb()
    const inserted = await recordClusterContribution(
      { ...baseCtx, db },
      { type: 'country', destination: 'SL' },
      { usdtAmount: 250000n, slearnAmount: 0n, slearnHash: '0xsinmonto' },
    )

    expect(inserted).toBe(0)
    expect(rows).toHaveLength(0)
  })

  it('is idempotent: a conflicting hash inserts nothing', async () => {
    const { db, rows } = ledgerDb(0)
    const inserted = await recordClusterContribution(
      { ...baseCtx, db },
      { type: 'country', destination: 'SL' },
      { usdtAmount: 250000n, slearnAmount: 0n, usdtHash: '0xrepetido' },
    )

    expect(inserted).toBe(0)
    expect(rows).toHaveLength(1)
  })
})
