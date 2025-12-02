import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
  .alterTable('billetera_usuario')
  .addColumn('nonce', 'varchar(255)')
  .addColumn('nonce_expires_at', 'timestamptz')
  .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
  .alterTable('billetera_usuario')
  .dropColumn('nonce')
  .dropColumn('nonce_expires_at')
  .execute()
}

