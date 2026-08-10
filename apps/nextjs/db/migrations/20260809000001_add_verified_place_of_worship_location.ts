import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ADD COLUMN verified_place_of_worship_location VARCHAR`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_place_of_worship_location`.execute(db)
}
