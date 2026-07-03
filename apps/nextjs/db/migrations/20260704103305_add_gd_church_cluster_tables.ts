import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ADD COLUMN church_relationship VARCHAR(10)`.execute(db)

  await sql`
    CREATE TABLE church (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      country_id INTEGER NOT NULL,
      city VARCHAR(255),
      pastor_name TEXT,
      pastor_whatsapp TEXT,
      cluster_wallet VARCHAR(42),
      created_by INTEGER REFERENCES usuario(id) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db)

  await sql`
    CREATE TABLE clustergd (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      code VARCHAR(6) UNIQUE NOT NULL,
      country_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_cluster_name_per_country UNIQUE(name, country_id)
    )
  `.execute(db)

  await sql`
    CREATE TABLE church_clustergd (
      id SERIAL PRIMARY KEY,
      church_id INTEGER REFERENCES church(id) NOT NULL,
      clustergd_id INTEGER REFERENCES clustergd(id) NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      left_at TIMESTAMP
    )
  `.execute(db)

  await sql`
    CREATE TABLE clustergd_history (
      id SERIAL PRIMARY KEY,
      clustergd_id INTEGER REFERENCES clustergd(id) NOT NULL,
      event_type VARCHAR(20) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by INTEGER REFERENCES usuario(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS clustergd_history`.execute(db)
  await sql`DROP TABLE IF EXISTS church_clustergd`.execute(db)
  await sql`DROP TABLE IF EXISTS clustergd`.execute(db)
  await sql`DROP TABLE IF EXISTS church`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS church_relationship`.execute(db)
}
