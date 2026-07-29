import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ADD COLUMN pastor_name VARCHAR(100)`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN pastor_whatsapp VARCHAR(20)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS pastor_whatsapp`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS pastor_name`.execute(db)
}
