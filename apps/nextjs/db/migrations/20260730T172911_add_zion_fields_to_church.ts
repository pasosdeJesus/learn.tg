import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('church')
    .addColumn('pastoral_position_israel_covenant', 'varchar(3)')
    .addColumn('pastoral_position_israel_remnant', 'varchar(3)')
    .addColumn('pastoral_position_israel_gaza', 'varchar(3)')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('church')
    .dropColumn('pastoral_position_israel_gaza')
    .dropColumn('pastoral_position_israel_remnant')
    .dropColumn('pastoral_position_israel_covenant')
    .execute()
}
