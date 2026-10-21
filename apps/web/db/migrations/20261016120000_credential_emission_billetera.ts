import { Kysely, sql } from 'kysely'

// R-#265 §3.1/§3.7 — la credencial sigue a la billetera que completó el curso.
// https://github.com/pasosdeJesus/learn.tg/issues/265
//
// `credential_emission` guarda `usuario_id` + `course_id` + `token_id` y **ninguna
// dirección**, así que el perfil no podía decir qué billetera de la cuenta tiene el
// SBT ni a cuál revocar/re-acuñar cuando una se pierde o se compromete. La sesión
// identifica la **cuenta** (N billeteras), no la billetera.
//
// La columna queda NULL para las emisiones históricas (no se inventa la billetera);
// las nuevas la escriben. Aditiva e idempotente, reversible.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE credential_emission ADD COLUMN IF NOT EXISTS billetera character varying(60)`.execute(db)
  await sql`CREATE INDEX IF NOT EXISTS credential_emission_billetera_idx ON credential_emission (billetera)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS credential_emission_billetera_idx`.execute(db)
  await sql`ALTER TABLE credential_emission DROP COLUMN IF EXISTS billetera`.execute(db)
}
