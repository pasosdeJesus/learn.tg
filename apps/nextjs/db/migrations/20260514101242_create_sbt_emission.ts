import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('sbt_emission')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('usuario_id', 'integer', (col) =>
      col.references('usuario.id').onDelete('cascade').notNull()
    )
    .addColumn('proyectofinanciero_id', 'integer', (col) =>
      col.references('cor1440_gen_proyectofinanciero.id').onDelete('cascade').notNull()
    )
    .addColumn('emitted_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull()
    )
    .addColumn('hash', 'varchar(66)', (col) => col.unique().notNull())
    .execute()

  // Índice para búsquedas rápidas de certificados de un usuario
  await db.schema
    .createIndex('sbt_emission_usuario_id_proyectofinanciero_id_idx')
    .on('sbt_emission')
    .columns(['usuario_id', 'proyectofinanciero_id'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('sbt_emission').execute()
}
