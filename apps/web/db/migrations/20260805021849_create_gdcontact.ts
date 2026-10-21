import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE gdcontact (
      id SERIAL PRIMARY KEY,
      cluster_id INTEGER REFERENCES clustergd(id) UNIQUE,
      cluster_sent_at TIMESTAMP,
      pdj_sent_at TIMESTAMP,
      gd_responded_at TIMESTAMP,
      released_at TIMESTAMP,
      release_reason VARCHAR(50),
      course_completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db)

  await sql`CREATE INDEX idx_gdcontact_cluster_id ON gdcontact(cluster_id)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS gdcontact`.execute(db)
}
