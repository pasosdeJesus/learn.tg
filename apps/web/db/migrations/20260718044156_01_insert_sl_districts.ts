import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    INSERT INTO msip_departamento (id, nombre, pais_id, fechacreacion, created_at, updated_at)
    VALUES
      (79, 'Bo', 694, NOW(), NOW(), NOW()),
      (80, 'Bombali', 694, NOW(), NOW(), NOW()),
      (81, 'Bonthe', 694, NOW(), NOW(), NOW()),
      (82, 'Fabala', 694, NOW(), NOW(), NOW()),
      (83, 'Kailahun', 694, NOW(), NOW(), NOW()),
      (84, 'Kambia', 694, NOW(), NOW(), NOW()),
      (85, 'Karene', 694, NOW(), NOW(), NOW()),
      (86, 'Kenema', 694, NOW(), NOW(), NOW()),
      (87, 'Koinadugu', 694, NOW(), NOW(), NOW()),
      (88, 'Kono', 694, NOW(), NOW(), NOW()),
      (89, 'Moyamba', 694, NOW(), NOW(), NOW()),
      (90, 'Port Loko', 694, NOW(), NOW(), NOW()),
      (91, 'Pujehun', 694, NOW(), NOW(), NOW()),
      (92, 'Tonkolili', 694, NOW(), NOW(), NOW()),
      (93, 'Western Area Rural', 694, NOW(), NOW(), NOW()),
      (94, 'Western Area Urban', 694, NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DELETE FROM msip_departamento WHERE id BETWEEN 79 AND 94
  `.execute(db)
}
