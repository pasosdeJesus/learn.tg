import { Kysely, sql } from 'kysely'

// Allow `type = 'pastor_bonus'` in the transaction table (44 SLEARN bonus for
// verified non-Zionist pastors in pilot countries, funded by the churches fund).
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE transaction DROP CONSTRAINT transaction_tipo_check
  `.execute(db)
  await sql`
    ALTER TABLE transaction ADD CONSTRAINT transaction_tipo_check
    CHECK (type IN ('scholarship', 'donation', 'donation_reward', 'pay-course', 'ubi-claim', 'conversion', 'pastor_bonus'))
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE transaction DROP CONSTRAINT transaction_tipo_check
  `.execute(db)
  await sql`
    ALTER TABLE transaction ADD CONSTRAINT transaction_tipo_check
    CHECK (type IN ('scholarship', 'donation', 'donation_reward', 'pay-course', 'ubi-claim', 'conversion'))
  `.execute(db)
}
