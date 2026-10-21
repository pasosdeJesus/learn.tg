import { Kysely } from 'kysely'

// Notifications table (R-#162 phase 1 MVP). Stores in-app notifications for
// users (e.g. the 44 SLEARN pastor bonus). Email/WhatsApp channels are out of
// scope for this MVP.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('notifications')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('usuario_id', 'integer', (col) => col.references('usuario.id'))
    .addColumn('type', 'varchar(50)')
    .addColumn('title', 'varchar(200)')
    .addColumn('content', 'text')
    .addColumn('link', 'varchar(500)')
    .addColumn('is_read', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(new Date()).notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('notifications').execute()
}
