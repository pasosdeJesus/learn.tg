import { Kysely, sql } from 'kysely'

// Allow `type = 'cluster_contribution'` in the transaction ledger: the 10% of a
// Global Disciples course purchase or guide scholarship routed on-chain to the
// cluster/country fund (one row per token, using the real transfer hash).
// https://github.com/pasosdeJesus/learn.tg/issues/161 — decisión 2026-10-26.
const PREVIOUS_TYPES = [
  'scholarship', 'donation', 'donation_reward', 'pay-course',
  'ubi-claim', 'conversion', 'pastor_bonus',
  'referral_reward', 'referral_bonus',
]
const TYPES = [...PREVIOUS_TYPES, 'cluster_contribution']

const check = (types: string[]) =>
  sql`ALTER TABLE transaction ADD CONSTRAINT transaction_tipo_check CHECK (type IN (${sql.join(types.map((t) => sql`'${sql.raw(t)}'`), sql`, `)}))`

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE transaction DROP CONSTRAINT transaction_tipo_check`.execute(db)
  await check(TYPES).execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DELETE FROM transaction WHERE type = 'cluster_contribution'`.execute(db)
  await sql`ALTER TABLE transaction DROP CONSTRAINT transaction_tipo_check`.execute(db)
  await check(PREVIOUS_TYPES).execute(db)
}
