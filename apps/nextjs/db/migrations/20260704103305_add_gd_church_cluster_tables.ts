import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // ── usuario columns ──
  await sql`ALTER TABLE usuario ADD COLUMN church_relationship VARCHAR(10)`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN whatsapp VARCHAR(20)`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN telegram VARCHAR(50)`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN country_id INTEGER REFERENCES msip_pais(id)`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN department_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN municipality_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN city_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN place_of_worship VARCHAR(100)`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN church_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN id_photo_front TEXT`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN id_photo_back TEXT`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN verified_whatsapp VARCHAR(20)`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN verified_telegram VARCHAR(50)`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN verified_department_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN verified_municipality_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN verified_city_id INTEGER`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN verified_place_of_worship VARCHAR(100)`.execute(db)
  await sql`ALTER TABLE usuario ADD COLUMN id_photo_verified BOOLEAN DEFAULT FALSE`.execute(db)

  // ── church table ──
  await sql`
    CREATE TABLE church (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      country_id INTEGER NOT NULL REFERENCES msip_pais(id),
      department_id INTEGER,
      municipality_id INTEGER,
      city_id INTEGER,
      city_name TEXT,
      address TEXT,
      pastor_name VARCHAR(100) NOT NULL,
      pastor_whatsapp VARCHAR(20) NOT NULL,
      pastor_telegram VARCHAR(50),
      pastor_id INTEGER REFERENCES usuario(id),
      cluster_wallet VARCHAR(42),
      denomination VARCHAR(100),
      registration VARCHAR(50),
      registration_photo TEXT,
      registration_verified BOOLEAN DEFAULT FALSE,
      created_by INTEGER REFERENCES usuario(id) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db)

  // ── clustergd table ──
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

  // ── church_clustergd join table ──
  await sql`
    CREATE TABLE church_clustergd (
      id SERIAL PRIMARY KEY,
      church_id INTEGER REFERENCES church(id) NOT NULL,
      clustergd_id INTEGER REFERENCES clustergd(id) NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      left_at TIMESTAMP
    )
  `.execute(db)

  // ── clustergd_history table ──
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

  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS id_photo_verified`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_place_of_worship`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_city_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_municipality_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_department_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_telegram`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS verified_whatsapp`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS id_photo_back`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS id_photo_front`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS church_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS place_of_worship`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS city_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS municipality_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS department_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS country_id`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS telegram`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS whatsapp`.execute(db)
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS church_relationship`.execute(db)
}
