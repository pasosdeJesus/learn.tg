import { Kysely, sql } from 'kysely'

// REQ/223: el ledger registra donaciones a campañas. USDC y XAUt0 (Celo
// mainnet, direcciones verificadas en REQ/223 §8) se reciben vía
// /api/donations/[slug]/verify; amplía el CHECK de `transaction.crypto`.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_crypto_check,
    ADD CONSTRAINT transaction_crypto_check
    CHECK (crypto::text = ANY (ARRAY['usdt', 'usdc', 'xaut0', 'celo', 'learningpoints', 'slearn']))
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_crypto_check,
    ADD CONSTRAINT transaction_crypto_check
    CHECK (crypto::text = ANY (ARRAY['usdt', 'celo', 'learningpoints', 'slearn']))
  `.execute(db)
}
