import { Kysely, sql } from 'kysely'

// https://github.com/pasosdeJesus/learn.tg/issues/163 — Programa de referidos: tablas de códigos/relaciones + tipos de
// transacción `referral_reward` y `referral_bonus` (pagos off-chain desde la
// referral wallet).

const REFERRAL_TYPES = [
  'scholarship', 'donation', 'donation_reward', 'pay-course',
  'ubi-claim', 'conversion', 'pastor_bonus',
  'referral_reward', 'referral_bonus',
]

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('referralcode')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('usuario_id', 'integer', (c) => c.notNull().references('usuario.id'))
    .addColumn('code', 'varchar(20)', (c) => c.notNull().unique())
    .addColumn('activated_at', 'timestamp', (c) => c.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('expires_at', 'timestamp')
    .addColumn('active', 'boolean', (c) => c.defaultTo(true))
    .execute()

  await db.schema
    .createTable('referralrelationship')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('referrer_id', 'integer', (c) => c.notNull().references('usuario.id'))
    .addColumn('referred_id', 'integer', (c) => c.notNull().references('usuario.id'))
    .addColumn('referral_code', 'varchar(20)')
    .addColumn('referral_claimed_at', 'timestamp', (c) => c.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('created_at', 'timestamp', (c) => c.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('status', 'varchar(20)', (c) => c.defaultTo('pending'))
    .addUniqueConstraint('referralrelationship_referred_unique', ['referred_id'])
    .execute()

  await sql`ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS transaction_tipo_check`.execute(db)
  await sql`ALTER TABLE "transaction" ADD CONSTRAINT transaction_tipo_check CHECK (type IN (${sql.join(REFERRAL_TYPES.map((t) => sql`'${sql.raw(t)}'`), sql`, `)}))`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('referralrelationship').execute()
  await db.schema.dropTable('referralcode').execute()
  await sql`ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS transaction_tipo_check`.execute(db)
  await sql`ALTER TABLE "transaction" ADD CONSTRAINT transaction_tipo_check CHECK (type IN ('scholarship','donation','donation_reward','pay-course','ubi-claim','conversion','pastor_bonus'))`.execute(db)
}
