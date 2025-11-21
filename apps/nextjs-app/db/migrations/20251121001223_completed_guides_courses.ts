import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
  .createTable('usuario_guidepaid')
  .addColumn('usuario_id', 'integer', (col) => col.notNull())
  .addColumn('proyectofinanciero_id', 'integer', (col) => col.notNull())
  .addColumn('actividadml_id', 'integer', (col) => col.notNull())
  .addColumn('amountpaid', 'integer', (col) => col.notNull())
  .addColumn('profilescore', 'integer', (col) => col.notNull())
  .addColumn('amount_pending', 'integer', (col) => col.notNull())
  .addColumn('points', 'integer', (col) => col.notNull())
  .execute();
  await db.schema
  .createTable('usuario_coursecompleted')
  .addColumn('usuario_id', 'integer', (col) => col.notNull())
  .addColumn('proyectofinanciero_id', 'integer', (col) => col.notNull())
  .addColumn('points', 'integer', (col) => col.notNull())
  .execute();

}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('usuario_coursecompleted').execute()
  await db.schema.dropTable('usuario_guidepaid').execute()
}
