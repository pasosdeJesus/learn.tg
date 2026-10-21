import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('site_nonces')
    .addColumn('site', 'varchar(100)', (col) => col.notNull().primaryKey())
    .addColumn('available_learningpoints', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('last_nonce', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('updated_at', 'timestamp')
    .execute()

  // Seed initial records
  await db.insertInto('site_nonces').values([
    { site: 'learn.tg', available_learningpoints: 0, last_nonce: 0 },
    { site: 'stable-sl.pdJ.app', available_learningpoints: 0, last_nonce: 0 },
    { site: 'sivel.xyz', available_learningpoints: 100, last_nonce: 0 },
  ]).execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('site_nonces').ifExists().execute()
}
