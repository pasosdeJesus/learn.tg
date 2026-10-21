
import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('ubitransactions')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('wallet', 'varchar(42)', (col) => col.notNull())
    .addColumn('amount', 'decimal(30, 18)', (col) => col.notNull())
    .addColumn('hash', 'varchar(66)', (col) => col.notNull().unique())
    .addColumn('date', 'timestamp', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ubitransactions').execute()
}
