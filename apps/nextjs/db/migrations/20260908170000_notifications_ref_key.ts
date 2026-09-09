import { Kysely } from 'kysely'

// REQ/223 — alertas a verificadores de operaciones con la billetera del backend
// como intermediaria (p. ej. reenvío de donación pendiente): `ref_key` permite
// (a) insertar la alerta una sola vez por evento/usuario (idempotencia entre
// reintentos) y (b) marcarla como leída para TODOS los destinatarios cuando la
// operación se resuelve (un único update por type + ref_key).
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('notifications')
    .addColumn('ref_key', 'varchar(100)')
    .execute()
  await db.schema
    .createIndex('notifications_type_ref_key_idx')
    .on('notifications')
    .columns(['type', 'ref_key'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('notifications_type_ref_key_idx').execute()
  await db.schema.alterTable('notifications').dropColumn('ref_key').execute()
}
