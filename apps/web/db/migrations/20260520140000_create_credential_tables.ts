import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('credential_emission')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('usuario_id', 'integer', (col) =>
      col.references('usuario.id').onDelete('cascade').notNull()
    )
    .addColumn('course_id', 'integer', (col) =>
      col.references('cor1440_gen_proyectofinanciero.id').onDelete('cascade').notNull()
    )
    .addColumn('token_id', 'integer', (col) => col.notNull())
    .addColumn('chain_id', 'varchar(20)', (col) =>
      col.defaultTo('celo').notNull()
    )
    .addColumn('is_premium', 'boolean', (col) =>
      col.defaultTo(false).notNull()
    )
    .addColumn('hash', 'varchar(66)')
    .addColumn('emitted_at', 'timestamp', (col) =>
      col.defaultTo('now()').notNull()
    )
    .addUniqueConstraint('credential_emission_user_course_chain', [
      'usuario_id', 'course_id', 'chain_id',
    ])
    .execute()

  await db.schema
    .createIndex('credential_emission_usuario_idx')
    .on('credential_emission')
    .columns(['usuario_id'])
    .execute()

  await db.schema
    .createTable('credential_metadata')
    .addColumn('token_id', 'integer', (col) => col.notNull())
    .addColumn('chain_id', 'varchar(20)', (col) =>
      col.defaultTo('celo').notNull()
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('type', 'varchar(50)', (col) => col.notNull())
    .addColumn('site', 'varchar(50)', (col) => col.notNull())
    .addColumn('is_premium', 'boolean', (col) =>
      col.defaultTo(false)
    )
    .addColumn('is_soulbound', 'boolean', (col) =>
      col.defaultTo(true)
    )
    .addColumn('image_url', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo('now()').notNull()
    )
    .addPrimaryKeyConstraint('credential_metadata_pkey', [
      'token_id', 'chain_id',
    ])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('credential_metadata').execute()
  await db.schema.dropTable('credential_emission').execute()
}
