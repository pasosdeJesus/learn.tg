import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE msip_departamento ADD COLUMN timezone character varying(63)`.execute(db)
  console.log('Added msip_departamento.timezone')

  // Colombia → America/Bogota
  await sql`
    UPDATE msip_departamento SET timezone = 'America/Bogota' WHERE pais_id = 170 AND fechadeshabilitacion IS NULL
  `.execute(db)
  // Honduras → America/Tegucigalpa
  await sql`
    UPDATE msip_departamento SET timezone = 'America/Tegucigalpa' WHERE pais_id = 340 AND fechadeshabilitacion IS NULL
  `.execute(db)
  // Sierra Leone → Africa/Freetown
  await sql`
    UPDATE msip_departamento SET timezone = 'Africa/Freetown' WHERE pais_id = 694 AND fechadeshabilitacion IS NULL
  `.execute(db)
  // Venezuela → America/Caracas
  await sql`
    UPDATE msip_departamento SET timezone = 'America/Caracas' WHERE pais_id = 862 AND fechadeshabilitacion IS NULL
  `.execute(db)
  console.log('Populated msip_departamento.timezone for CO, HN, SL, VE')
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE msip_departamento DROP COLUMN timezone`.execute(db)
}
