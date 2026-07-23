// Migration: Rename date_of_interview → proposed_date_of_interview (R-#190).

import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario RENAME COLUMN date_of_interview TO proposed_date_of_interview`.execute(db)
  console.log('Renamed date_of_interview → proposed_date_of_interview')
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario RENAME COLUMN proposed_date_of_interview TO date_of_interview`.execute(db)
}
