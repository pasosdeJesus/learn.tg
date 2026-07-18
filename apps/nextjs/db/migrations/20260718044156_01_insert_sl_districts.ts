import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    INSERT INTO msip_departamento (nombre, pais_id, fechacreacion, created_at, updated_at)
    VALUES
      ('Bo', 694, NOW(), NOW(), NOW()),
    ('Bombali', 694, NOW(), NOW(), NOW()),
    ('Bonthe', 694, NOW(), NOW(), NOW()),
    ('Fabala', 694, NOW(), NOW(), NOW()),
    ('Kailahun', 694, NOW(), NOW(), NOW()),
    ('Kambia', 694, NOW(), NOW(), NOW()),
    ('Karene', 694, NOW(), NOW(), NOW()),
    ('Kenema', 694, NOW(), NOW(), NOW()),
    ('Koinadugu', 694, NOW(), NOW(), NOW()),
    ('Kono', 694, NOW(), NOW(), NOW()),
    ('Moyamba', 694, NOW(), NOW(), NOW()),
    ('Port Loko', 694, NOW(), NOW(), NOW()),
    ('Pujehun', 694, NOW(), NOW(), NOW()),
    ('Tonkolili', 694, NOW(), NOW(), NOW()),
    ('Western Area Rural', 694, NOW(), NOW(), NOW()),
    ('Western Area Urban', 694, NOW(), NOW(), NOW())
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DELETE FROM msip_departamento
    WHERE pais_id = 694
  `.execute(db)
}
