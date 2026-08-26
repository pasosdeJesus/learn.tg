import { describe, it, expect, vi } from 'vitest'
import { resolveGDClusterDestination, isGDCourse } from '../gd-cluster-routing'

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

  it('should resolve to country when no church cluster but country in pilot', async () => {
    const db = mockDb({
      churchResult: null,
      usuarioResult: { pais_id: 170 }, // Colombia
      paisResult: { alfa2: 'CO' },
    })

    const result = await resolveGDClusterDestination(db, 1)
    expect(result.type).toBe('country')
    expect(result.destination).toBe('CO')
  })

  it('should resolve to Sierra Leone when no church and country not in pilot', async () => {
    const db = mockDb({
      churchResult: null,
      usuarioResult: { pais_id: 999 }, // Not in pilot
    })

    const result = await resolveGDClusterDestination(db, 1)
    expect(result.type).toBe('sierra_leone')
    expect(result.destination).toBe('SL')
  })

  it('should resolve to Sierra Leone when church has no cluster_wallet', async () => {
    const db = mockDb({
      churchResult: { cluster_wallet: null, country_id: 170 },
      usuarioResult: { pais_id: 170 },
      paisResult: { alfa2: 'CO' },
    })

    // Should fall through to country since no cluster_wallet
    const result = await resolveGDClusterDestination(db, 1)
    expect(result.type).toBe('country')
    expect(result.destination).toBe('CO')
  })
})
