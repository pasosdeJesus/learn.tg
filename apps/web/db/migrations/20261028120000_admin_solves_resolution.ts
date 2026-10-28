import { Kysely, sql } from 'kysely'

// Cola de asuntos por resolver (`admin_solves`): las rutas insertan filas cuando algo
// falla después de mover dinero (por ejemplo, el 10% del curso GD que no se pudo
// registrar en `transaction`). Hasta ahora nadie las procesaba ni las veía; este par de
// columnas permite marcarlas resueltas desde el panel del verificador, con quién y con
// qué nota (https://github.com/pasosdeJesus/learn.tg/issues/161 §ledger).
// Reversible.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE admin_solves ADD COLUMN IF NOT EXISTS solved_by INTEGER REFERENCES usuario(id)`.execute(db)
  await sql`ALTER TABLE admin_solves ADD COLUMN IF NOT EXISTS note TEXT`.execute(db)
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_solves_created ON admin_solves (created_at DESC)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_admin_solves_created`.execute(db)
  await sql`ALTER TABLE admin_solves DROP COLUMN IF EXISTS note`.execute(db)
  await sql`ALTER TABLE admin_solves DROP COLUMN IF EXISTS solved_by`.execute(db)
}
