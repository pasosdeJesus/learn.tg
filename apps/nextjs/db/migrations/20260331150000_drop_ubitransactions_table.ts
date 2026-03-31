import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Final verification: ensure all ubitransactions rows have been migrated
  const orphanedRows = await sql`
    SELECT COUNT(*) as count
    FROM ubitransactions ut
    WHERE NOT EXISTS (
      SELECT 1 FROM transaction t WHERE t.hash = ut.hash
    )
  `.execute(db)

  const count = Number(orphanedRows.rows[0]?.count) || 0
  if (count > 0) {
    throw new Error(`Cannot drop ubitransactions: ${count} rows not migrated to transaction table`)
  }

  // Drop the legacy ubitransactions table
  await db.schema.dropTable('ubitransactions').execute()
  console.log('✅ Table ubitransactions dropped successfully')
}

export async function down(db: Kysely<any>): Promise<void> {
  // Re-create the ubitransactions table with original schema
  await db.schema
    .createTable('ubitransactions')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('wallet', 'varchar(42)', (col) => col.notNull())
    .addColumn('amount', sql`numeric(30,18)`, (col) => col.notNull())
    .addColumn('hash', 'varchar(66)', (col) => col.notNull().unique())
    .addColumn('date', 'timestamp', (col) => col.notNull())
    .execute()

  console.log('✅ Table ubitransactions re-created')

  // Re-populate from transaction table (ubi-claim records only)
  await sql`
    INSERT INTO ubitransactions (wallet, amount, hash, date)
    SELECT wallet, cantidad, hash, fecha
    FROM transaction
    WHERE tipo = 'ubi-claim' AND crypto = 'celo'
      AND hash IS NOT NULL
  `.execute(db)

  console.log('✅ Data migrated back to ubitransactions')
}