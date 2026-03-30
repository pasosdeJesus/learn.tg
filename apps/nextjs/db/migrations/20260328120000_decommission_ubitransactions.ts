import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Final migration of any rows in ubitransactions that might have been missed by previous migrations
  await sql`
    INSERT INTO transaction (
      usuario_id, fecha, tipo, crypto, cantidad,
      impacto_balance, hash, wallet, metadata, fecha_creacion, fecha_actualizacion
    )
    SELECT
      bu.usuario_id,
      ut.date AS fecha,
      'ubi-claim' AS tipo,
      'celo' AS crypto,
      ut.amount::decimal(18,2) AS cantidad,
      ut.amount::decimal(18,2) AS impacto_balance,
      ut.hash,
      ut.wallet AS wallet,
      jsonb_build_object('source', 'migrated-from-ubitransactions-final') AS metadata,
      NOW() AS fecha_creacion,
      NOW() AS fecha_actualizacion
    FROM ubitransactions ut
    JOIN billetera_usuario bu ON LOWER(bu.billetera) = LOWER(ut.wallet)
    WHERE NOT EXISTS (
      SELECT 1 FROM transaction t WHERE t.hash = ut.hash
    )
  `.execute(db)

  // Drop the legacy table (deferred)
  // await db.schema.dropTable('ubitransactions').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Re-create the ubitransactions table
  /*await db.schema
    .createTable('ubitransactions')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('wallet', 'varchar(42)', (col) => col.notNull())
    .addColumn('amount', sql`numeric(30,18)`, (col) => col.notNull())
    .addColumn('hash', 'varchar(66)', (col) => col.notNull().unique())
    .addColumn('date', 'timestamp', (col) => col.notNull())
    .execute() */

  // Re-populate from transaction (best effort)
  /*await sql`
    INSERT INTO ubitransactions (wallet, amount, hash, date)
    SELECT wallet, cantidad, hash, fecha
    FROM transaction
    WHERE tipo = 'ubi-claim' AND crypto = 'celo'
  `.execute(db)*/
}
