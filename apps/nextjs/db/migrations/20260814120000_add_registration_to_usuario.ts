import { Kysely } from 'kysely'

// Add church registration fields to usuario so a pastor can declare their
// church registration number and upload the registration document directly
// from the profile page (shown dynamically when church_relationship = 'pastor').
// The church table keeps its own registration/registration_photo for the
// verified church record; these usuario fields hold the pastor's declaration.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('usuario')
    .addColumn('registration', 'varchar(50)')
    .execute()
  await db.schema
    .alterTable('usuario')
    .addColumn('registration_photo', 'text')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('usuario')
    .dropColumn('registration_photo')
    .execute()
  await db.schema
    .alterTable('usuario')
    .dropColumn('registration')
    .execute()
}
