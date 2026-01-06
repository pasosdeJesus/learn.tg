import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Make usuario_id nullable
  await db.schema
    .alterTable('userevent')
    .alterColumn('usuario_id', (col) => col.dropNotNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Make usuario_id NOT NULL again (will fail if there are null values)
  await db.schema
    .alterTable('userevent')
    .alterColumn('usuario_id', (col) => col.setNotNull())
    .execute()
}
