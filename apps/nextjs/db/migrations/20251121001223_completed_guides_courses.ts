import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
  .createTable('guidepaid_usuario')
  .addColumn('usuario_id', 'integer', (col) => col.notNull())
  .addColumn('actividadpf_id', 'integer', (col) => col.notNull())
  .addColumn('amountpaid', 'integer', (col) => col.notNull())
  .addColumn('profilescore', 'integer', (col) => col.notNull())
  .addColumn('amountpending', 'integer', (col) => col.notNull())
  .addColumn('points', 'integer', (col) => col.notNull())
  .execute();
  await db.schema
  .createTable('coursecompleted_usuario')
  .addColumn('usuario_id', 'integer', (col) => col.notNull())
  .addColumn('proyectofinanciero_id', 'integer', (col) => col.notNull())
  .addColumn('points', 'integer', (col) => col.notNull())
  .execute();

}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('coursecompleted_usuario').execute()
  await db.schema.dropTable('guidepaid_usuario').execute()
}
