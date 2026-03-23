import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Migrate historical UBI data from ubitransactions to transaction table
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
      ut.amount::decimal(18,2) AS cantidad,  -- Convert decimal(30,18) to decimal(18,2)
      ut.amount::decimal(18,2) AS impacto_balance,  -- Positive: CELO inflow
      ut.hash,
      ut.wallet AS wallet,
      jsonb_build_object('source', 'migrated-from-ubitransactions') AS metadata,
      NOW() AS fecha_creacion,
      NOW() AS fecha_actualizacion
    FROM ubitransactions ut
    JOIN billetera_usuario bu ON LOWER(bu.billetera) = LOWER(ut.wallet)
    WHERE NOT EXISTS (
      SELECT 1 FROM transaction t WHERE t.hash = ut.hash
    )
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove migrated data (only those with source metadata)
  await sql`
    DELETE FROM transaction
    WHERE metadata->>'source' = 'migrated-from-ubitransactions'
  `.execute(db)
}