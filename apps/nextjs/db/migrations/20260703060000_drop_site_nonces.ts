import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('site_nonces').ifExists().execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('site_nonces')
    .addColumn('site', 'varchar', (col) => col.primaryKey())
    .addColumn('last_nonce', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('available_learningpoints', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.insertInto('site_nonces').values([
    { site: 'learn.tg', last_nonce: 0, available_learningpoints: 0 },
    { site: 'stable-sl.pdJ.app', last_nonce: 0, available_learningpoints: 0 },
    { site: 'sivel.xyz', last_nonce: 0, available_learningpoints: 0 },
  ]).execute()
}
