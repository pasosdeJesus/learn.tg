import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Add 'slearn' to allowed crypto values
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_crypto_check,
    ADD CONSTRAINT transaction_crypto_check
    CHECK (crypto IN ('usdt', 'celo', 'learningpoints', 'slearn'))
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove 'slearn' from allowed crypto values
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_crypto_check,
    ADD CONSTRAINT transaction_crypto_check
    CHECK (crypto IN ('usdt', 'celo', 'learningpoints'))
  `.execute(db)
}
