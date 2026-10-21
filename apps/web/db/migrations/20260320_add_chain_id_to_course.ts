import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('cor1440_gen_proyectofinanciero')
    .addColumn('chain_id', 'integer', (col) => col.defaultTo(42220))
    .addColumn('contract_address', 'varchar(255)')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('cor1440_gen_proyectofinanciero')
    .dropColumn('chain_id')
    .dropColumn('contract_address')
    .execute()
}
