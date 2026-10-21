import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
  .alterTable('guide_usuario')
  .addColumn('created_at', 'timestamp')
  .addColumn('updated_at', 'timestamp')
  .execute()
  await db.schema
  .alterTable('course_usuario')
  .addColumn('created_at', 'timestamp')
  .addColumn('updated_at', 'timestamp')
  .execute()

  await db.schema
  .createTable('userevent')
  .addColumn('id', 'bigserial', (col) => col.primaryKey())
  .addColumn('usuario_id', 'integer')
  .addColumn('event_type', 'varchar(30)', (col) => col.notNull() )
  .addColumn('event_data', 'jsonb')
  .addColumn('created_at', 'timestamp', (col) => col.notNull())
  .execute()

}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('guide_usuario')
  .dropColumn('updated_at')
  .dropColumn('created_at')
  .execute()
  await db.schema.alterTable('course_usuario')
  .dropColumn('updated_at')
  .dropColumn('created_at')
  .execute()
  await db.schema.dropTable('userevent').execute()
}


