import { describe, it, expect, vi } from 'vitest'
import { getUserTransactions } from '../user-transactions'

// El historial de movimientos debe traer `categoria`/`subcategoria` (además de los
// campos que ya traía) para que la UI pueda distinguir y agrupar, p. ej. las dos
// filas de una compra de curso pagada en USDT y SLEARN
// (https://github.com/pasosdeJesus/learn.tg/issues/128).

type Row = Record<string, any>

function fakeDb(rows: Row[]) {
  const selected: string[][] = []
  const db: any = {
    selectFrom: vi.fn(() => {
      const q: any = {
        select: (columns: string[]) => {
          selected.push(columns)
          return q
        },
        where: () => q,
        orderBy: () => q,
        execute: async () => rows,
      }
      return q
    }),
  }
  return { db, selected }
}

const PURCHASE_ROWS: Row[] = [
  {
    id: 2, type: 'pay-course', crypto: 'slearn', amount: '13.86', balance_impact: '-13.86',
    date: new Date('2026-09-21T18:00:00Z'), hash: '0xslearn', descripcion: 'paid: 13.86 SLEARN',
    categoria: 'payment', subcategoria: 'course_purchase',
  },
  {
    id: 1, type: 'pay-course', crypto: 'usdt', amount: '0.35', balance_impact: '-0.35',
    date: new Date('2026-09-21T18:00:00Z'), hash: '0xusdt', descripcion: 'paid: 0.35 USDT',
    categoria: 'payment', subcategoria: 'course_purchase',
  },
]

describe('getUserTransactions', () => {
  it('returns categoria and subcategoria for every movement', async () => {
    const { db } = fakeDb(PURCHASE_ROWS)

    const rows = await getUserTransactions(db, 191)

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => [r.crypto, r.categoria, r.subcategoria])).toEqual([
      ['slearn', 'payment', 'course_purchase'],
      ['usdt', 'payment', 'course_purchase'],
    ])
  })

  it('selects categoria and subcategoria (they cannot be dropped silently)', async () => {
    const { db, selected } = fakeDb(PURCHASE_ROWS)

    await getUserTransactions(db, 191)

    expect(selected[0]).toEqual(expect.arrayContaining(['categoria', 'subcategoria']))
  })

  it('converts the numeric amount and keeps the hash/description', async () => {
    const { db } = fakeDb(PURCHASE_ROWS)

    const rows = await getUserTransactions(db, 191)

    expect(rows[0].amount).toBe(13.86)
    expect(rows[0].hash).toBe('0xslearn')
    expect(rows[0].descripcion).toContain('SLEARN')
  })

  it('tolerates null categoria/subcategoria (older rows)', async () => {
    const { db } = fakeDb([{ ...PURCHASE_ROWS[0], categoria: null, subcategoria: null }])

    const rows = await getUserTransactions(db, 191)

    expect(rows[0].categoria).toBeNull()
    expect(rows[0].subcategoria).toBeNull()
  })
})
