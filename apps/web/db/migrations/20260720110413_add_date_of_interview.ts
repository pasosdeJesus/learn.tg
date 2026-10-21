import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ADD COLUMN date_of_interview DATE`.execute(db)
  console.log('Added usuario.date_of_interview')
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario DROP COLUMN date_of_interview`.execute(db)
}
