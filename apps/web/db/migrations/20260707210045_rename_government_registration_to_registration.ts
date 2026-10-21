import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE church RENAME COLUMN government_registration TO registration`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE church RENAME COLUMN registration TO government_registration`.execute(db)
}
