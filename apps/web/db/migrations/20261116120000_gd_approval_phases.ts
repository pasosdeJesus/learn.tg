import { Kysely, sql } from 'kysely'
import { createHash } from 'node:crypto'

// Máquina de estados de la presentación a Global Disciples y las dos fases de
// aprobación de los pastores (https://github.com/pasosdeJesus/learn.tg/issues/161,
// decisiones en REQ/161 §4.7).
//
// - `gd_status` deja de ser nullable: `forming` es un estado de verdad (antes era
//   `NULL`) y `approved` desaparece (`requested` ya significa "los pastores
//   aprobaron los datos y el clúster pide la presentación"). Los clústeres en
//   `approved` vuelven a `requested`: nunca se verificaron en el contrato.
// - `cluster_gd_approval` gana `phase` (`wallet` | `data`) y su PK pasa a incluirla.
//   El hash `data` deja de incluir la billetera (cada fase tiene el suyo), así que se
//   recalcula para las filas existentes, y los clústeres que ya están en el proceso
//   reciben su aprobación `wallet` (la billetera estaba aprobada de hecho: estaba
//   fija) para que su fondo siga teniendo sentido.
//
// Reversible.

const NEW_STATUSES = [
  'forming',
  'wallet_approved',
  'waiting_for_budget',
  'waiting_for_pd_job_offer',
  'requested',
  'under_review',
  'returned',
  'sent',
  'answered',
  'cancelled',
]

/** Clústeres que ya pasaron la aprobación de la billetera. */
const APPROVED_WALLET_STATES = [
  'wallet_approved',
  'waiting_for_budget',
  'waiting_for_pd_job_offer',
  'requested',
  'under_review',
  'returned',
  'sent',
  'answered',
]

function part(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

/** Igual que `presentationDataHash` (lib/cluster-approvals.ts): los cinco datos. */
function dataHash(row: any): string {
  return createHash('sha256')
    .update(
      [
        row.fourth_year_budget,
        row.budget_draft_path,
        row.director_offer_path,
        row.director_first_year_pay,
        row.director_first_year_hours,
      ]
        .map(part)
        .join('|'),
    )
    .digest('hex')
}

/** Igual que `walletHash` (lib/cluster-approvals.ts). */
function walletHash(wallet: unknown): string {
  return createHash('sha256').update(part(wallet)).digest('hex')
}

export async function up(db: Kysely<any>): Promise<void> {
  // ── gd_status ──────────────────────────────────────────────────────────
  await sql`ALTER TABLE clustergd DROP CONSTRAINT IF EXISTS clustergd_gd_status_check`.execute(db)
  await sql`UPDATE clustergd SET gd_status = 'forming' WHERE gd_status IS NULL`.execute(db)
  await sql`UPDATE clustergd SET gd_status = 'requested' WHERE gd_status = 'approved'`.execute(db)
  await sql`ALTER TABLE clustergd ALTER COLUMN gd_status SET DEFAULT 'forming'`.execute(db)
  await sql`ALTER TABLE clustergd ALTER COLUMN gd_status SET NOT NULL`.execute(db)
  await sql`
    ALTER TABLE clustergd
      ADD CONSTRAINT clustergd_gd_status_check
      CHECK (gd_status IN (${sql.raw(NEW_STATUSES.map((value) => `'${value}'`).join(', '))}))
  `.execute(db)

  // ── fases de aprobación ────────────────────────────────────────────────
  await db.schema.alterTable('cluster_gd_approval').addColumn('phase', 'varchar(10)').execute()
  await sql`UPDATE cluster_gd_approval SET phase = 'data'`.execute(db)
  await sql`ALTER TABLE cluster_gd_approval ALTER COLUMN phase SET NOT NULL`.execute(db)
  await sql`
    ALTER TABLE cluster_gd_approval
      ADD CONSTRAINT cluster_gd_approval_phase_check CHECK (phase IN ('wallet', 'data'))
  `.execute(db)
  await sql`ALTER TABLE cluster_gd_approval DROP CONSTRAINT cluster_gd_approval_pkey`.execute(db)
  await sql`
    ALTER TABLE cluster_gd_approval
      ADD CONSTRAINT cluster_gd_approval_pkey PRIMARY KEY (clustergd_id, usuario_id, phase)
  `.execute(db)

  // El hash de los datos ya no incluye la billetera: se recalcula para que las
  // aprobaciones dadas sigan valiendo.
  const clusters = await sql<any>`
    SELECT c.id, c.gd_status, c.fourth_year_budget, c.budget_draft_path,
           c.director_offer_path, c.director_first_year_pay,
           c.director_first_year_hours, ch.cluster_wallet
      FROM clustergd c
      LEFT JOIN church ch ON ch.id = c.initiator_church_id
  `.execute(db)

  for (const row of clusters.rows) {
    await sql`
      UPDATE cluster_gd_approval
         SET data_hash = ${dataHash(row)}
       WHERE clustergd_id = ${row.id} AND phase = 'data'
    `.execute(db)

    if (APPROVED_WALLET_STATES.includes(row.gd_status) && row.cluster_wallet) {
      await sql`
        INSERT INTO cluster_gd_approval (clustergd_id, usuario_id, phase, data_hash, created_at)
        SELECT clustergd_id, usuario_id, 'wallet', ${walletHash(row.cluster_wallet)}, created_at
          FROM cluster_gd_approval
         WHERE clustergd_id = ${row.id} AND phase = 'data'
        ON CONFLICT DO NOTHING
      `.execute(db)
    }
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DELETE FROM cluster_gd_approval WHERE phase = 'wallet'`.execute(db)
  await sql`ALTER TABLE cluster_gd_approval DROP CONSTRAINT cluster_gd_approval_pkey`.execute(db)
  await sql`ALTER TABLE cluster_gd_approval DROP CONSTRAINT IF EXISTS cluster_gd_approval_phase_check`.execute(db)
  await db.schema.alterTable('cluster_gd_approval').dropColumn('phase').execute()
  await sql`
    ALTER TABLE cluster_gd_approval
      ADD CONSTRAINT cluster_gd_approval_pkey PRIMARY KEY (clustergd_id, usuario_id)
  `.execute(db)

  await sql`ALTER TABLE clustergd DROP CONSTRAINT clustergd_gd_status_check`.execute(db)
  await sql`UPDATE clustergd SET gd_status = 'approved' WHERE gd_status = 'returned'`.execute(db)
  await sql`
    UPDATE clustergd
       SET gd_status = NULL
     WHERE gd_status IN ('forming', 'wallet_approved', 'waiting_for_budget', 'waiting_for_pd_job_offer')
  `.execute(db)
  await sql`ALTER TABLE clustergd ALTER COLUMN gd_status DROP DEFAULT`.execute(db)
  await sql`ALTER TABLE clustergd ALTER COLUMN gd_status DROP NOT NULL`.execute(db)
  await sql`
    ALTER TABLE clustergd
      ADD CONSTRAINT clustergd_gd_status_check
      CHECK (gd_status IS NULL OR gd_status IN
        ('requested', 'under_review', 'returned', 'approved', 'sent', 'answered', 'cancelled'))
  `.execute(db)
}
