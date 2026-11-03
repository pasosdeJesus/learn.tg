// Un pastor cuya iglesia estuvo en un clúster que ya recibió los fondos no puede
// volver a participar en otro clúster
// (https://github.com/pasosdeJesus/learn.tg/issues/161).
//
// El recorrido de un clúster termina cuando Global Disciples responde y el fondo
// se libera (`clustergd.fund_released_at`): esa iglesia ya cumplió su ciclo y no
// vuelve a empezar con un fondo nuevo. La regla se aplica al crear, al unirse por
// código y al aceptar una invitación.

export interface CompletedCluster {
  cluster_id: number
  name: string
  fund_released_at: unknown
}

/** Clúster del que la iglesia ya recibió fondos, si existe. */
export async function churchCompletedCluster(
  db: any,
  churchId: number,
): Promise<CompletedCluster | null> {
  const row = await db
    .selectFrom('church_clustergd as cc')
    .innerJoin('clustergd as c', 'c.id', 'cc.clustergd_id')
    .select(['c.id as cluster_id', 'c.name', 'c.fund_released_at'])
    .where('cc.church_id', '=', churchId)
    .where('c.fund_released_at', 'is not', null)
    .executeTakeFirst()
  return (row as CompletedCluster) ?? null
}
