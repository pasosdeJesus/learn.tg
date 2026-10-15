import { Kysely, sql } from 'kysely'

// R-#260 Part B / R-#285 - align learn.tg's database with the base model (msip 2.2)
// now that the baseline covers the whole 40-table model.
// https://github.com/pasosdeJesus/learn.tg/issues/285
//
// With the base model in `m`'s five tables the check was green after
// `20261010022121_alinear_modelo_base_msip.ts`; the `msip` engine ships the
// complete model (40 tables), so `bin/m eng:check` now also grades the `msip_*`
// auxiliary tables and reported four more *restrictive* drifts
// (https://gitlab.com/pasosdeJesus/m/-/work_items/46):
//   - `msip_anexo.descripcion` is nullable; the base declares `NOT NULL`
//   - `msip_grupo_usuario.grupo_id` and `usuario_id` are `bigint`; the base
//     declares `integer` (both reference `integer` primary keys: `msip_grupo.id`
//     and `usuario.id`)
//   - `msip_orgsocial_persona.orgsocial_id` is nullable; the base declares `NOT NULL`
//
// These are msip auxiliary tables learn.tg does not use. Measured on the
// development database (2026-10-13) before writing this: the three tables had 0
// rows, so the `SET NOT NULL`/type changes cannot fail on existing data.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE msip_anexo ALTER COLUMN descripcion SET NOT NULL`.execute(db)
  await sql`ALTER TABLE msip_grupo_usuario ALTER COLUMN grupo_id TYPE integer USING grupo_id::integer`.execute(db)
  await sql`ALTER TABLE msip_grupo_usuario ALTER COLUMN usuario_id TYPE integer USING usuario_id::integer`.execute(db)
  await sql`ALTER TABLE msip_orgsocial_persona ALTER COLUMN orgsocial_id SET NOT NULL`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE msip_orgsocial_persona ALTER COLUMN orgsocial_id DROP NOT NULL`.execute(db)
  await sql`ALTER TABLE msip_grupo_usuario ALTER COLUMN usuario_id TYPE bigint USING usuario_id::bigint`.execute(db)
  await sql`ALTER TABLE msip_grupo_usuario ALTER COLUMN grupo_id TYPE bigint USING grupo_id::bigint`.execute(db)
  await sql`ALTER TABLE msip_anexo ALTER COLUMN descripcion DROP NOT NULL`.execute(db)
}
