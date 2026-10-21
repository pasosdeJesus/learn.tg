import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
  .alterTable('course_usuario')
  .addColumn('guidespoints', 'numeric')
  .addColumn('amountscholarship', 'numeric')
  .addColumn('percentagecompleted', 'numeric')
  .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
  .alterTable('course_usuario')
  .dropColumn('guidespoints')
  .dropColumn('amountscholarship')
  .dropColumn('percentagecompleted')
  .execute()
}

