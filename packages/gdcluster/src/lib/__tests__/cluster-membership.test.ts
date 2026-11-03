import { describe, it, expect } from 'vitest'
import { churchCompletedCluster } from '../cluster-membership.js'

// Un clúster que ya desembolsó fondos cierra el ciclo de sus iglesias
// (https://github.com/pasosdeJesus/learn.tg/issues/161): no vuelven a empezar.

function fakeDb(row: any) {
  const where: any[] = []
  const builder: any = {
    selectFrom: () => builder,
    innerJoin: () => builder,
    select: () => builder,
    where: (...args: any[]) => {
      where.push(args)
      return builder
    },
    executeTakeFirst: async () => row,
  }
  return { db: builder, where }
}

describe('churchCompletedCluster (R-#161)', () => {
  it('lets the church through when no cluster released funds', async () => {
    const { db } = fakeDb(null)
    expect(await churchCompletedCluster(db, 173)).toBeNull()
  })

  it('returns the cluster that already released the funds', async () => {
    const row = { cluster_id: 54, name: 'Cl2', fund_released_at: '2026-11-03T10:00:00.000Z' }
    const { db } = fakeDb(row)
    expect(await churchCompletedCluster(db, 173)).toEqual(row)
  })

  it('filters by church and by released funds', async () => {
    const { db, where } = fakeDb(null)
    await churchCompletedCluster(db, 173)
    expect(where).toContainEqual(['cc.church_id', '=', 173])
    expect(where).toContainEqual(['c.fund_released_at', 'is not', null])
  })
})
