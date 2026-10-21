import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Add wallet column (nullable initially)
  await db.schema
    .alterTable('transaction')
    .addColumn('wallet', 'varchar(42)')
    .execute()

  // Update existing transactions with user's wallet
  await sql`
    UPDATE transaction t
    SET wallet = bu.billetera
    FROM billetera_usuario bu
    WHERE t.usuario_id = bu.usuario_id
      AND t.wallet IS NULL
  `.execute(db)

  // Make wallet NOT NULL
  await db.schema
    .alterTable('transaction')
    .alterColumn('wallet', (col) => col.setNotNull())
    .execute()

  // Optional foreign key constraint (uncomment if desired)
  // await sql`
  //   ALTER TABLE transaction ADD CONSTRAINT transaction_wallet_usuario_fk
  //   FOREIGN KEY (wallet, usuario_id) REFERENCES billetera_usuario(billetera, usuario_id)
  // `.execute(db)

  // Add index for wallet-based queries
  await db.schema
    .createIndex('transaction_wallet_fecha_idx')
    .on('transaction')
    .columns(['wallet', 'fecha'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove foreign key if added
  // await sql`ALTER TABLE transaction DROP CONSTRAINT IF EXISTS transaction_wallet_usuario_fk`.execute(db)

  await db.schema
    .alterTable('transaction')
    .dropColumn('wallet')
    .execute()
}