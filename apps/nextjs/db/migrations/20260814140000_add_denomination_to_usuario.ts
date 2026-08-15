import { Kysely } from 'kysely'

// Add a church denomination field to usuario so a pastor can declare their
// church denomination from the profile page (shown when
// church_relationship = 'pastor'). Copied to the church record when the
// verifier assigns an existing church.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('usuario')
    .addColumn('denomination', 'varchar(100)')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('usuario')
    .dropColumn('denomination')
    .execute()
}
