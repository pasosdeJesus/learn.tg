import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Make usuario_id nullable
  await db.schema
    .alterTable('userevent')
    .alterColumn('usuario_id', (col) => col.dropNotNull())
    .execute()
  const up = await sql<any>`
      UPDATE guide_usuario SET created_at = NOW() WHERE created_at IS NULL; 
    `.execute(db)
  console.log("up=", up)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Make usuario_id NOT NULL again (will fail if there are null values)
  await db.schema
    .alterTable('userevent')
    .alterColumn('usuario_id', (col) => col.setNotNull())
    .execute()
}
