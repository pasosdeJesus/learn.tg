import { Kysely, sql } from 'kysely'

// La billetera del clúster se fija cuando la aprueba el pastor iniciador (REQ/161 §4.7):
// desde ese momento los demás pastores pueden aprobarla y nadie puede cambiarla; el caso
// extremo (billetera comprometida) lo resuelve soporte en la base.
//
// Se guarda en una columna propia (`wallet_fixed_at`) en lugar de deducirlo de
// `cluster_gd_approval` para que el candado de `PATCH /api/cluster/[id]` sea una lectura
// de la fila del clúster y no una consulta extra con su propio hash.
//
// Reversible.

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('clustergd').addColumn('wallet_fixed_at', 'timestamptz').execute()

  // Clústeres que ya tenían aprobaciones de la billetera: la billetera estaba fija de
  // hecho (el esquema anterior no permitía cambiarla con el fondo abierto).
  await sql`
    UPDATE clustergd c
       SET wallet_fixed_at = COALESCE(
             (SELECT MIN(a.created_at) FROM cluster_gd_approval a
               WHERE a.clustergd_id = c.id AND a.phase = 'wallet'),
             c.updated_at
           )
     WHERE EXISTS (
       SELECT 1 FROM cluster_gd_approval a
        WHERE a.clustergd_id = c.id AND a.phase = 'wallet'
     )
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('clustergd').dropColumn('wallet_fixed_at').execute()
}
