import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('guide_usuario')
    .addColumn('created_at', 'timestamp')
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema
    .createTable('user_event')
    .addColumn('id', 'bigserial', (col) => col.notNull())
    .addColumn('usuario_id', 'integer', (col) => col.notNull())
    .addColumn('event_type', 'varchar(30)' )
    .addColumn('event_data', 'jsonb')
    .addColumn('created_at', 'timestamp')
    .addColumn('updated_at', 'timestamp')
    .execute()

}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('guide_usuario')
  	.dropColumn('updated_at')
  	.dropColumn('created_at')
	.execute()
  await db.schema.dropTable('user_event').execute()
}


