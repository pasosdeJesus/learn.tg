// Migration: usuario.proposed_date_of_interview date → timestamptz (R-#190 fix).
//
// The column was a plain `date`: it dropped the interview time at write and pg
// read it back as server-local midnight, so a 2PM slot displayed as 5AM in
// UTC+0 browsers. Align with conducted_date_of_interview (already timestamptz).

import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ALTER COLUMN proposed_date_of_interview TYPE TIMESTAMPTZ USING (proposed_date_of_interview::timestamp AT TIME ZONE 'UTC')`.execute(db)
  console.log('proposed_date_of_interview → TIMESTAMPTZ')
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ALTER COLUMN proposed_date_of_interview TYPE DATE USING (proposed_date_of_interview::date)`.execute(db)
  console.log('proposed_date_of_interview → DATE')
}
