import { Kysely, sql } from 'kysely';

// R-#260 Part B - align learn.tg's database with the base model (msip 2.2).
// https://github.com/pasosdeJesus/learn.tg/issues/260
//
// `bin/m db:check` reported three *restrictive* drifts against the published
// baseline (`@pasosdejesus/m/base-model`, https://gitlab.com/pasosdeJesus/m/-/work_items/46):
// the authoritative schema of msip 2.2 (`msip-2.2/test/dummy/db/structure.sql`)
// declares
//   - `usuario.unlock_token` as `character varying(64)`,
//   - `msip_municipio.departamento_id` as `NOT NULL`,
//   - `msip_centropoblado.municipio_id` as `NOT NULL`,
// while learn.tg's database still has `varchar(255)` and both foreign keys
// nullable. Both ALTERs fail loudly instead of losing data: `SET NOT NULL`
// refuses to run when a NULL row exists and shrinking the type refuses when a
// value does not fit.
//
// Measured on the development database (2026-10-10) before writing this: 0
// municipalities without `departamento_id`, 0 populated centres without
// `municipio_id`, and `usuario.unlock_token` empty in every row.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ALTER COLUMN unlock_token TYPE character varying(64)`.execute(db)
  await sql`ALTER TABLE msip_municipio ALTER COLUMN departamento_id SET NOT NULL`.execute(db)
  await sql`ALTER TABLE msip_centropoblado ALTER COLUMN municipio_id SET NOT NULL`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE msip_centropoblado ALTER COLUMN municipio_id DROP NOT NULL`.execute(db)
  await sql`ALTER TABLE msip_municipio ALTER COLUMN departamento_id DROP NOT NULL`.execute(db)
  await sql`ALTER TABLE usuario ALTER COLUMN unlock_token TYPE character varying(255)`.execute(db)
}
