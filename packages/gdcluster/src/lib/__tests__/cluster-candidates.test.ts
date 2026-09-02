import { describe, it, expect, vi } from 'vitest'
import { getClusterCandidates } from '../gd-utils'

// Mock de DB que registra las cláusulas WHERE por tabla/alias y devuelve
// filas configuradas por consulta (patrón de gd-cluster-routing.test.ts).
function mockDb({ referredRows = [], referrerRows = [] }: {
  referredRows?: Record<string, any>[]
  referrerRows?: Record<string, any>[]
} = {}) {
  const allWhereCalls: string[][] = []
  // Cada selectFrom devuelve un builder con sus propias cláusulas WHERE; al
  // ejecutar decide las filas según si registró rr.referrer_id (consulta de
  // referidos) o rr.referred_id (consulta del referidor).
  const db = {
    selectFrom: vi.fn(() => {
      const localCalls: string[][] = []
      const builder: any = {
        innerJoin: () => builder,
        leftJoin: () => builder,
        select: () => builder,
        execute: vi.fn(async () => {
          const cols = localCalls.map(([col]) => col)
          return cols.includes('rr.referrer_id') ? referredRows : referrerRows
        }),
        where: (col: string, op: any, val: any) => {
          const entry = [col, String(op), String(val)]
          localCalls.push(entry)
          allWhereCalls.push(entry)
          return builder
        },
      }
      return builder
    }),
    whereCalls: allWhereCalls,
  }
  return db
}

describe('getClusterCandidates (https://github.com/pasosdeJesus/learn.tg/issues/220 §2.1)', () => {
  const LEADER = 191
  const COUNTRY = 694

  it('returns referred pastors with the expected filters and dedupes', async () => {
    const db = mockDb({
      referredRows: [
        { usuario_id: 1, nombre: 'Pastor A', nusuario: 'pastorA', church_id: 11, church_name: 'Iglesia A', country_id: 694 },
        { usuario_id: 2, nombre: 'Pastor B', nusuario: 'pastorB', church_id: 12, church_name: 'Iglesia B', country_id: 694 },
      ],
      referrerRows: [
        { usuario_id: 1, nombre: 'Pastor A', nusuario: 'pastorA', church_id: 11, church_name: 'Iglesia A', country_id: 694 },
      ],
    })
    const candidates = await getClusterCandidates(db as any, LEADER, COUNTRY, 99)

    // Dedupe: Pastor A aparece como referido y como referidor → una sola vez
    expect(candidates.map((c) => c.usuario_id)).toEqual([1, 2])
    expect(candidates[0]).toMatchObject({ nusuario: 'pastorA', church_name: 'Iglesia A' })

    // Filtros SQL aplicados en ambas consultas
    const filterCols = db.whereCalls.map(([col]) => col)
    expect(filterCols).toContain('rr.referrer_id')
    expect(filterCols).toContain('rr.referred_id')
    expect(filterCols.filter((c) => c === 'u.church_relationship').length).toBe(2)
    expect(filterCols.filter((c) => c === 'c.country_id').length).toBe(2)
    expect(filterCols.filter((c) => c === 'c.registration_verified').length).toBe(2)
    expect(filterCols.filter((c) => c === 'cc.church_id').length).toBe(2) // sin clúster
    expect(filterCols.filter((c) => c === 'u.fechadeshabilitacion').length).toBe(2)
    // Excluye la iglesia del líder
    expect(db.whereCalls.filter(([col, , val]) => col === 'c.id' && val === '99').length).toBe(2)
  })

  it('returns empty when there are no referred pastors nor referrer', async () => {
    const db = mockDb({})
    const candidates = await getClusterCandidates(db as any, LEADER, COUNTRY, 99)
    expect(candidates).toEqual([])
  })

  it('prioritizes referred pastors before the referrer', async () => {
    const db = mockDb({
      referredRows: [{ usuario_id: 7, nombre: 'Referido', nusuario: 'ref', church_id: 1, church_name: 'R', country_id: 694 }],
      referrerRows: [{ usuario_id: 8, nombre: 'Referidor', nusuario: 'refr', church_id: 2, church_name: 'Rd', country_id: 694 }],
    })
    const candidates = await getClusterCandidates(db as any, LEADER, COUNTRY, 99)
    expect(candidates.map((c) => c.usuario_id)).toEqual([7, 8])
  })
})
