import { Kysely, sql } from 'kysely'

// Estados de la presentación a Global Disciples, datos que se fijan con la
// solicitud y salida del ranking (https://github.com/pasosdeJesus/learn.tg/issues/161).
//
// - `gd_status` reemplaza el booleano implícito de `gd_requested_at`/`gd_sent_at`:
//   requested → under_review → returned → approved → sent → answered, con `cancelled`
//   para que el iniciador retire la solicitud antes de la revisión.
// - Presupuesto del primer año y oferta del director: se editan mientras el estado no
//   los bloquee (`budget_fixed_at`/`director_fixed_at` guardan cuándo se fijaron).
// - `cluster_fund_vote` registra el Withdraw de cada pastor; la primera marca la salida
//   del ranking (`ranking_exited_at`).
// - `clustergd_history.event_type` era varchar(20) y los eventos de esta función
//   ('gd_presentation_requested', 25 caracteres) no cabían: se amplía.
//
// Reversible.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE clustergd_history ALTER COLUMN event_type TYPE varchar(40)`.execute(db)

  await db.schema
    .alterTable('clustergd')
    .addColumn('gd_status', 'varchar(20)')
    .addColumn('gd_reviewed_at', 'timestamptz')
    .addColumn('gd_returned_at', 'timestamptz')
    .addColumn('gd_approved_at', 'timestamptz')
    .addColumn('gd_answered_at', 'timestamptz')
    .addColumn('gd_evaluation', 'text')
    .addColumn('gd_suggestions', 'text')
    .addColumn('first_year_budget', sql`numeric(12,2)`)
    .addColumn('budget_draft_path', 'varchar(255)')
    .addColumn('budget_fixed_at', 'timestamptz')
    .addColumn('director_offer_path', 'varchar(255)')
    .addColumn('director_first_year_pay', sql`numeric(12,2)`)
    .addColumn('director_first_year_hours', sql`numeric(8,2)`)
    .addColumn('director_fixed_at', 'timestamptz')
    .addColumn('ranking_exited_at', 'timestamptz')
    .execute()

  await sql`
    ALTER TABLE clustergd
      ADD CONSTRAINT clustergd_gd_status_check
      CHECK (gd_status IS NULL OR gd_status IN
        ('requested', 'under_review', 'returned', 'approved', 'sent', 'answered', 'cancelled'))
  `.execute(db)

  // Clústeres que ya habían pedido o enviado la presentación antes de `gd_status`.
  await sql`
    UPDATE clustergd
       SET gd_status = CASE
             WHEN gd_response_at IS NOT NULL THEN 'answered'
             WHEN gd_sent_at IS NOT NULL THEN 'sent'
             WHEN gd_requested_at IS NOT NULL THEN 'requested'
             ELSE NULL
           END
  `.execute(db)

  await db.schema
    .createTable('cluster_fund_vote')
    .addColumn('clustergd_id', 'integer', (c) => c.notNull().references('clustergd.id'))
    .addColumn('usuario_id', 'integer', (c) => c.notNull().references('usuario.id'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addPrimaryKeyConstraint('cluster_fund_vote_pkey', ['clustergd_id', 'usuario_id'])
    .execute()

  await sql`CREATE INDEX cluster_fund_vote_cluster_idx ON cluster_fund_vote (clustergd_id)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('cluster_fund_vote').execute()
  await sql`ALTER TABLE clustergd DROP CONSTRAINT IF EXISTS clustergd_gd_status_check`.execute(db)
  await db.schema
    .alterTable('clustergd')
    .dropColumn('gd_status')
    .dropColumn('gd_reviewed_at')
    .dropColumn('gd_returned_at')
    .dropColumn('gd_approved_at')
    .dropColumn('gd_answered_at')
    .dropColumn('gd_evaluation')
    .dropColumn('gd_suggestions')
    .dropColumn('first_year_budget')
    .dropColumn('budget_draft_path')
    .dropColumn('budget_fixed_at')
    .dropColumn('director_offer_path')
    .dropColumn('director_first_year_pay')
    .dropColumn('director_first_year_hours')
    .dropColumn('director_fixed_at')
    .dropColumn('ranking_exited_at')
    .execute()

  await sql`ALTER TABLE clustergd_history ALTER COLUMN event_type TYPE varchar(20)`.execute(db)
}
