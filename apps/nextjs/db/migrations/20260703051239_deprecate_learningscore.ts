import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario RENAME COLUMN learningscore TO learningscore_deprecated`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario RENAME COLUMN learningscore_deprecated TO learningscore`.execute(db)
}
