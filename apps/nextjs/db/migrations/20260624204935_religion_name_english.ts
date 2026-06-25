import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Add name_english column for English translations
  await sql`ALTER TABLE religion ADD COLUMN IF NOT EXISTS name_english VARCHAR(500)`.execute(db)

  // Store current English names and set Spanish names
  await sql`UPDATE religion SET name_english = nombre WHERE name_english IS NULL`.execute(db)

  await sql`UPDATE religion SET nombre = 'Sin información'  WHERE id = 1`.execute(db)
  await sql`UPDATE religion SET nombre = 'Cristianismo'       WHERE id = 2`.execute(db)
  await sql`UPDATE religion SET nombre = 'Islam'              WHERE id = 3`.execute(db)
  await sql`UPDATE religion SET nombre = 'Budismo'            WHERE id = 4`.execute(db)
  await sql`UPDATE religion SET nombre = 'Hinduismo'          WHERE id = 5`.execute(db)
  await sql`UPDATE religion SET nombre = 'Judaísmo'           WHERE id = 6`.execute(db)
  await sql`UPDATE religion SET nombre = 'Otra'               WHERE id = 7`.execute(db)
  await sql`UPDATE religion SET nombre = 'Ninguna'            WHERE id = 8`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`UPDATE religion SET nombre = name_english`.execute(db)
  await sql`ALTER TABLE religion DROP COLUMN IF EXISTS name_english`.execute(db)
}
