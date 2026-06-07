import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Drop old unique constraint on hash alone
  await sql`ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS transaction_hash_key`.execute(db)
  // Add compound unique on (crypto, hash)
  await sql`ALTER TABLE "transaction" ADD CONSTRAINT transaction_crypto_hash_key UNIQUE (crypto, hash)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS transaction_crypto_hash_key`.execute(db)
  await sql`ALTER TABLE "transaction" ADD CONSTRAINT transaction_hash_key UNIQUE (hash)`.execute(db)
}
