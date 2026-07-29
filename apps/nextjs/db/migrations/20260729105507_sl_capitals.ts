import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    INSERT INTO msip_municipio (id, nombre, departamento_id, fechacreacion, created_at, updated_at)
    VALUES
      (1967, 'Bo City', 79, NOW(), NOW(), NOW()),
      (1968, 'Freetown City', 94, NOW(), NOW(), NOW()),
      (1969, 'Waterloo City', 93, NOW(), NOW(), NOW()),
      (1970, 'Kenema City', 86, NOW(), NOW(), NOW()),
      (1971, 'Kailahun City', 83, NOW(), NOW(), NOW()),
      (1972, 'Moyamba City', 89, NOW(), NOW(), NOW()),
      (1973, 'Pujehun City', 91, NOW(), NOW(), NOW()),
      (1974, 'Makeni City', 80, NOW(), NOW(), NOW()),
      (1975, 'Koinadugu City', 87, NOW(), NOW(), NOW()),
      (1976, 'Tonkolili City', 92, NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `.execute(db)

  // 2. Insertar 10 capitales en msip_centropoblado (47230-47239)
  await sql`
    INSERT INTO msip_centropoblado (id, nombre, municipio_id, latitud, longitud, fechacreacion, created_at, updated_at)
    VALUES
      (47230, 'Bo', 1967, 7.962065, -11.73665, NOW(), NOW(), NOW()),
      (47231, 'Freetown', 1968, 8.479002, -13.268016, NOW(), NOW(), NOW()),
      (47232, 'Waterloo', 1969, 8.338977, -13.069573, NOW(), NOW(), NOW()),
      (47233, 'Kenema', 1970, 7.885936, -11.18639, NOW(), NOW(), NOW()),
      (47234, 'Kailahun', 1971, 8.277001, -10.573943, NOW(), NOW(), NOW()),
      (47235, 'Moyamba', 1972, 8.159278, -12.431391, NOW(), NOW(), NOW()),
      (47236, 'Pujehun', 1973, 7.356632, -11.721245, NOW(), NOW(), NOW()),
      (47237, 'Makeni', 1974, 8.88474, -12.04912, NOW(), NOW(), NOW()),
      (47238, 'Koinadugu', 1975, 9.536055, -11.368845, NOW(), NOW(), NOW()),
      (47239, 'Tonkolili', 1976, 8.6657, -11.937805, NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DELETE FROM msip_centropoblado WHERE id BETWEEN 47230 AND 47239
  `.execute(db)

  await sql`
    DELETE FROM msip_municipio WHERE id BETWEEN 1967 AND 1976
  `.execute(db)
}
