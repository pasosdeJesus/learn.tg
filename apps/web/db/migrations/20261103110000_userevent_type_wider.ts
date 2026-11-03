import { Kysely, sql } from 'kysely'

// `userevent.event_type` era varchar(30) y varios eventos ya superan ese largo
// (`gd_presentation_approved_by_pastor`, `wallet_unlink_credential_revoke`,
// `wallet_unlink_credential_revoke_failed`). El INSERT fallaba con
// "value too long for type character varying(30)" y la ruta respondía 500 aunque
// el efecto principal (la aprobación del pastor) sí se hubiera guardado.
// Se ensancha a varchar(80), igual que `clustergd_history.event_type`
// (https://github.com/pasosdeJesus/learn.tg/issues/161).

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE userevent ALTER COLUMN event_type TYPE varchar(80)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE userevent ALTER COLUMN event_type TYPE varchar(30)`.execute(db)
}
