import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_municipality_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_department_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS municipality_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS department_id`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ADD COLUMN department_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN municipality_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN verified_department_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN verified_municipality_id INTEGER`.execute(db)
}
