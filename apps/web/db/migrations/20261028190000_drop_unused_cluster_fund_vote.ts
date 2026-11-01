import { Kysely, sql } from 'kysely'

// Limpieza del flujo de votos de retiro (https://github.com/pasosdeJesus/learn.tg/issues/161):
// el retiro ya no se vota — los pastores aprueban la presentación y los fondos se liberan
// automáticamente cuando GD responde — así que `cluster_fund_vote` y
// `clustergd.ranking_exited_at` quedaron sin uso y sin filas. Se eliminan.
//
// Reversible: el `down` recrea la tabla y la columna con la misma estructura.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS cluster_fund_vote`.execute(db)
  await sql`ALTER TABLE clustergd DROP COLUMN IF EXISTS ranking_exited_at`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('clustergd')
    .addColumn('ranking_exited_at', 'timestamptz')
    .execute()

  await db.schema
    .createTable('cluster_fund_vote')
    .addColumn('clustergd_id', 'integer', (c) => c.notNull().references('clustergd.id'))
    .addColumn('usuario_id', 'integer', (c) => c.notNull().references('usuario.id'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addPrimaryKeyConstraint('cluster_fund_vote_pkey', ['clustergd_id', 'usuario_id'])
    .execute()

  await sql`CREATE INDEX cluster_fund_vote_cluster_idx ON cluster_fund_vote (clustergd_id)`.execute(db)
}
