import { Kysely, sql } from 'kysely'

// Aprobación de los pastores para presentar el clúster a Global Disciples
// (https://github.com/pasosdeJesus/learn.tg/issues/161, decisión del operador
// 2026-10-22): cada pastor principal de las iglesias del clúster pulsa un botón con el
// que confirma que **conoce y aprueba** lo que se enviará a GD (presupuesto del primer
// año, oferta del director) y la billetera del clúster. Con todas las aprobaciones el
// iniciador solicita la revisión de pdJ; la billetera queda fija desde la solicitud y los
// fondos (país y clúster) se liberan automáticamente cuando GD responde.
//
// `data_hash` es el hash de los cinco datos + la billetera en el momento de aprobar: si
// pdJ devuelve la solicitud y el iniciador cambia alguno, las aprobaciones dejan de valer
// y hay que volver a pedirlas; si no cambió nada, valen.
//
// Reversible. La tabla `cluster_fund_vote` (votos de retiro) queda sin uso: el retiro ya
// no se vota, se dispara al responder GD.

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('cluster_gd_approval')
    .addColumn('clustergd_id', 'integer', (c) => c.notNull().references('clustergd.id'))
    .addColumn('usuario_id', 'integer', (c) => c.notNull().references('usuario.id'))
    .addColumn('data_hash', 'varchar(64)', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addPrimaryKeyConstraint('cluster_gd_approval_pkey', ['clustergd_id', 'usuario_id'])
    .execute()

  await sql`CREATE INDEX cluster_gd_approval_cluster_idx ON cluster_gd_approval (clustergd_id)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('cluster_gd_approval').execute()
}
