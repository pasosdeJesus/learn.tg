import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('transactions')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('usuario_id', 'integer', (col) =>
      col.references('usuario.id').onDelete('cascade').notNull()
    )
    .addColumn('fecha', 'timestamp', (col) => col.notNull())
    .addColumn('tipo', 'varchar(20)', (col) => col.notNull())
    .addColumn('categoria', 'varchar(50)')
    .addColumn('subcategoria', 'varchar(50)')
    .addColumn('descripcion', 'text')
    .addColumn('crypto', 'varchar(50)', (col) => col.notNull())
    .addColumn('cantidad', 'decimal(18, 2)', (col) => col.defaultTo('1.00').notNull())
    .addColumn('impacto_balance', 'decimal(18, 2)', (col) => col.notNull())
    .addColumn('hash', 'varchar(66)', (col) => col.unique())
    .addColumn('metadata', 'jsonb')
    .addColumn('fecha_creacion', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull()
    )
    .addColumn('fecha_actualizacion', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull()
    )
    .addColumn('sincronizado', 'boolean', (col) => col.defaultTo(true).notNull())
    .execute();

  // Add CHECK constraints using raw SQL for better control
  await sql`
    ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_tipo_check"
    CHECK (tipo IN ('earn-guide', 'donation', 'pay-course'));
  `.execute(db);

  await sql`
    ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_crypto_check"
    CHECK (crypto IN ('learningpoints', 'usdt'));
  `.execute(db);

  // Add indexes
  await db.schema
    .createIndex('transactions_usuario_id_fecha_idx')
    .on('transactions')
    .columns(['usuario_id', 'fecha'])
    .execute();

  await db.schema
    .createIndex('transactions_tipo_categoria_idx')
    .on('transactions')
    .columns(['tipo', 'categoria'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('transactions').execute()
}
