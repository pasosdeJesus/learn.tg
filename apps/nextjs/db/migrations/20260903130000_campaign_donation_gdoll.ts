import { Kysely, sql } from 'kysely'

// REQ/223: recepción de G$ (GoodDollar) en donaciones de campaña — Celo
// mainnet, 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A (18 decimals).
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_crypto_check,
    ADD CONSTRAINT transaction_crypto_check
    CHECK (crypto::text = ANY (ARRAY['usdt', 'usdc', 'xaut0', 'gdoll', 'celo', 'learningpoints', 'slearn']))
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_crypto_check,
    ADD CONSTRAINT transaction_crypto_check
    CHECK (crypto::text = ANY (ARRAY['usdt', 'usdc', 'xaut0', 'celo', 'learningpoints', 'slearn']))
  `.execute(db)
}
