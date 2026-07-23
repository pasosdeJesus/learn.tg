// Migration: Prepare DB for verification admin dashboard (R-#190).
//
// Adds:
//   - usuario.conducted_date_of_interview
//   - usuario.verified_church_relationship
//   - usuario.working_hours
//   - church.merged_into_id
//   - church.deleted_at
//   - verification_log table
//
// Note: proposed_date_of_interview is created by renaming date_of_interview
// in the next migration (20260723030000).

import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ADD COLUMN conducted_date_of_interview TIMESTAMPTZ`.execute(db)
  console.log('Added usuario.conducted_date_of_interview')

  await sql`ALTER TABLE usuario ADD COLUMN verified_church_relationship VARCHAR(20)`.execute(db)
  console.log('Added usuario.verified_church_relationship')

  await sql`ALTER TABLE usuario ADD COLUMN working_hours JSONB`.execute(db)
  console.log('Added usuario.working_hours')

  await sql`ALTER TABLE church ADD COLUMN merged_into_id INTEGER REFERENCES church(id)`.execute(db)
  console.log('Added church.merged_into_id')

  await sql`ALTER TABLE church ADD COLUMN deleted_at TIMESTAMPTZ`.execute(db)
  console.log('Added church.deleted_at')

  await sql`
    CREATE TABLE verification_log (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuario(id),
      action VARCHAR(50) NOT NULL,
      details JSONB,
      performed_by INTEGER REFERENCES usuario(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db)
  console.log('Created verification_log')
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS conducted_date_of_interview`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_church_relationship`.execute(db)
  await sql`ALTER TABLE church DROP COLUMN IF EXISTS merged_into_id`.execute(db)
  await sql`ALTER TABLE church DROP COLUMN IF EXISTS deleted_at`.execute(db)
  await sql`DROP TABLE IF EXISTS verification_log`.execute(db)
}
