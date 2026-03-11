import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // First, drop the view that depends on the column
  await db.schema.dropView('view_user_scores').ifExists().execute();

  // Alter the column type to support floating-point numbers
  await db.schema
    .alterTable('usuario')
    .alterColumn('learningscore', (ac) => ac.setDataType('double precision'))
    .execute();

  // Recreate the view with the updated column type
  await db.schema
    .createView('view_user_scores')
    .as(
      db.selectFrom('usuario').select([
        'id as user_id',
        'learningscore',
        'profilescore',
      ])
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the view before altering the column back
  await db.schema.dropView('view_user_scores').ifExists().execute();

  // Revert the column type back to integer
  // Note: This might cause data loss if there are fractional values
  await db.schema
    .alterTable('usuario')
    .alterColumn('learningscore', (ac) => ac.setDataType('integer'))
    .execute();

  // Recreate the view with the original column type
  await db.schema
    .createView('view_user_scores')
    .as(
      db.selectFrom('usuario').select([
        'id as user_id',
        'learningscore',
        'profilescore',
      ])
    )
    .execute();
}
