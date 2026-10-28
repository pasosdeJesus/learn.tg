import { Kysely, sql } from 'kysely'

// R-#220: el rol se llama **iniciador del clúster** (UI, API y guías) para no
// confundirlo con el director de programa ni con el pastor principal de la iglesia.
// El esquema se alinea: `clustergd.leader_church_id` → `initiator_church_id` y el
// evento de historial `leader_transfer` → `initiator_transfer`.
// https://github.com/pasosdeJesus/learn.tg/issues/220 — 2026-10-27.
//
// Reversible. Los valores del historial se renombran, no se pierden: las filas viejas
// quedan con el nombre nuevo (el `down` las devuelve al nombre anterior).

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE clustergd RENAME COLUMN leader_church_id TO initiator_church_id`.execute(db)
  await sql`ALTER TABLE clustergd RENAME CONSTRAINT clustergd_leader_church_id_fkey TO clustergd_initiator_church_id_fkey`.execute(db)
  await sql`UPDATE clustergd_history SET event_type = 'initiator_transfer' WHERE event_type = 'leader_transfer'`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`UPDATE clustergd_history SET event_type = 'leader_transfer' WHERE event_type = 'initiator_transfer'`.execute(db)
  await sql`ALTER TABLE clustergd RENAME CONSTRAINT clustergd_initiator_church_id_fkey TO clustergd_leader_church_id_fkey`.execute(db)
  await sql`ALTER TABLE clustergd RENAME COLUMN initiator_church_id TO leader_church_id`.execute(db)
}
