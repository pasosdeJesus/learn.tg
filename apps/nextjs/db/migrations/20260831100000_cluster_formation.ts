import { Kysely, sql } from 'kysely'

// REQ/220 — Cluster Formation (Simplified): sobre el modelo GD existente.
// Añade pseudonym/status/leader_church_id a `clustergd` y crea la tabla
// `cluster_invitation` (invitaciones a pastores; la membresía sigue en
// `church_clustergd` — no se crean tablas de clúster paralelas).

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('clustergd')
    .addColumn('pseudonym', 'varchar(100)')
    .addColumn('status', 'varchar(20)', (c) => c.notNull().defaultTo('pending'))
    .addColumn('leader_church_id', 'integer', (c) => c.references('church.id'))
    .execute()

  await db.schema
    .createTable('cluster_invitation')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('clustergd_id', 'integer', (c) => c.notNull().references('clustergd.id'))
    .addColumn('invited_pastor_id', 'integer', (c) => c.notNull().references('usuario.id'))
    .addColumn('invited_church_id', 'integer', (c) => c.notNull().references('church.id'))
    .addColumn('invited_by_id', 'integer', (c) => c.notNull().references('usuario.id'))
    .addColumn('status', 'varchar(20)', (c) => c.notNull().defaultTo('pending'))
    .addColumn('created_at', 'timestamp', (c) => c.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('responded_at', 'timestamp')
    .addUniqueConstraint('cluster_invitation_cluster_pastor_unique', ['clustergd_id', 'invited_pastor_id'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('cluster_invitation').execute()
  await db.schema
    .alterTable('clustergd')
    .dropColumn('pseudonym')
    .dropColumn('status')
    .dropColumn('leader_church_id')
    .execute()
}
