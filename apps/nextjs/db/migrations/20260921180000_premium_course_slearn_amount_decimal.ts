import { Kysely, sql } from 'kysely'

// `premium_course_usuario.slearn_amount_paid` nació como INTEGER en centésimas
// (100 = 1.00 SLEARN), mientras `usdt_amount_paid` era DECIMAL(10,2) en dólares.
// La misma ruta (`packages/rewards/src/routes/premium-purchase.ts`) escribía una
// en centésimas y la otra en unidades, y cada lector tenía que acordarse de
// dividir por 100 (la primera versión mostró 1386.00 SLEARN en vez de 13.86).
//
// Se unifica a DECIMAL(10,2) en SLEARN, como el resto de la contabilidad:
//   - la ruta guarda el valor legible (13.86),
//   - `transaction.amount` (crypto='slearn') ya guardaba SLEARN legibles,
//   - y el perfil y el panel de transparencia dejan de convertir.
//
// Los valores existentes son centésimas: se dividen por 100 al cambiar el tipo.
// Ver https://github.com/pasosdeJesus/learn.tg/issues/128.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE premium_course_usuario
      ALTER COLUMN slearn_amount_paid TYPE DECIMAL(10,2)
      USING (ROUND(slearn_amount_paid::numeric / 100, 2))
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE premium_course_usuario
      ALTER COLUMN slearn_amount_paid TYPE INTEGER
      USING (ROUND(slearn_amount_paid * 100)::integer)
  `.execute(db)
}
