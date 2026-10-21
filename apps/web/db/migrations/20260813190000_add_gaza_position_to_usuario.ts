import { Kysely } from 'kysely'

// Add a per-user Gaza position field. The GD course access model was
// simplified to a single Gaza question answered by each user in their own
// profile (previously it was three questions answered at church registration).
// 'no' = non-Zionist (allowed), 'yes' = supports Israel in the Gaza genocide.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('usuario')
    .addColumn('position_israel_gaza', 'varchar(3)')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('usuario')
    .dropColumn('position_israel_gaza')
    .execute()
}
