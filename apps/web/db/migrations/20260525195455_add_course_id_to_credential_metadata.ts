import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('credential_metadata')
    .addColumn('course_id', 'integer', (col) =>
      col.references('cor1440_gen_proyectofinanciero.id').onDelete('cascade')
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('credential_metadata')
    .dropColumn('course_id')
    .execute()
}
