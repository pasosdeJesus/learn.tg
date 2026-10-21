import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE admin_solves (
      id BIGSERIAL PRIMARY KEY,
      type VARCHAR(100) NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}',
      solved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db)

  // Index for pending items (solved_at IS NULL)
  await sql`
    CREATE INDEX idx_admin_solves_pending ON admin_solves (type, solved_at)
    WHERE solved_at IS NULL
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS admin_solves`.execute(db)
}
