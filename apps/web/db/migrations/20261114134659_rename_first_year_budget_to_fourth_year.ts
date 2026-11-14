import { Kysely } from 'kysely'

// El presupuesto del clúster se piensa al **cuarto año**: Global Disciples financia los
// tres primeros y desde el cuarto el clúster camina solo. La columna guarda lo mismo; sólo
// cambia de nombre (decisión del operador, 2026-11-14).
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('clustergd')
    .renameColumn('first_year_budget', 'fourth_year_budget')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('clustergd')
    .renameColumn('fourth_year_budget', 'first_year_budget')
    .execute()
}
