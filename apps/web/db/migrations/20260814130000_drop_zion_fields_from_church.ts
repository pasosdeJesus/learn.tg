import { Kysely } from 'kysely'

// Drop the church-level Zionism position columns. Zionism is now detected
// per-user via usuario.position_israel_gaza (see 20260813190000).
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('church').dropColumn('pastoral_position_israel_covenant').execute()
  await db.schema.alterTable('church').dropColumn('pastoral_position_israel_remnant').execute()
  await db.schema.alterTable('church').dropColumn('pastoral_position_israel_gaza').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('church').addColumn('pastoral_position_israel_covenant', 'varchar(3)').execute()
  await db.schema.alterTable('church').addColumn('pastoral_position_israel_remnant', 'varchar(3)').execute()
  await db.schema.alterTable('church').addColumn('pastoral_position_israel_gaza', 'varchar(3)').execute()
}
