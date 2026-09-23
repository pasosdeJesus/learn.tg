import { Kysely, sql } from 'kysely'

// Privacidad de la afiliación cristiana
// (https://github.com/pasosdeJesus/learn.tg/issues/259).
//
// 1. Dos interruptores por usuario:
//    - `mostrar_cursos_publico`: publicar las completaciones de cursos (TRUE
//      conserva el comportamiento actual: el estudiante se sale).
//    - `mostrar_cursos_cristianos_publico`: permiso ADICIONAL para los cursos
//      marcados como cristianos; FALSE por defecto, porque es lo que expone a una
//      persona en un contexto de persecución. Solo cuenta si el primero también
//      está en TRUE (AND explícito en el servidor).
// 2. `contenido_cristiano` en los cursos: el dato que consultan las reglas de
//    visibilidad y las de acuñación (nunca el título ni una lista de ids).
//    La migración marca los cursos que ya existen.
// 3. Revocación propia del SBT: `credential_emission` guarda cuándo y con qué
//    transacción se revocó, para excluirla de las superficies públicas y del
//    ranking sin perder el historial del estudiante.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS mostrar_cursos_publico BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS mostrar_cursos_cristianos_publico BOOLEAN NOT NULL DEFAULT FALSE
  `.execute(db)

  await sql`
    ALTER TABLE cor1440_gen_proyectofinanciero
      ADD COLUMN IF NOT EXISTS contenido_cristiano BOOLEAN NOT NULL DEFAULT FALSE
  `.execute(db)

  // Cursos cristianos existentes (por `prefijoRuta`, la fuente de verdad del
  // catálogo): "Una relación con Jesús" (es/en) y el curso Global Disciples
  // (gdcluster/redgd). `web3-and-ubi`, `ahorra-en-dolares-en-okx` y los cursos de
  // negocios son contenido técnico/comercial: el operador decide si se marcan.
  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET contenido_cristiano = TRUE
    WHERE "prefijoRuta" IN (
      '/una-relacion-con-Jesus',
      '/a-relationship-with-Jesus',
      '/gdcluster',
      '/redgd'
    )
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS idx_proyectofinanciero_contenido_cristiano
      ON cor1440_gen_proyectofinanciero (contenido_cristiano)
  `.execute(db)

  await sql`
    ALTER TABLE credential_emission
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS revoke_hash VARCHAR(66)
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS idx_credential_emission_revoked_at
      ON credential_emission (revoked_at)
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_credential_emission_revoked_at`.execute(db)
  await sql`
    ALTER TABLE credential_emission
      DROP COLUMN IF EXISTS revoked_at,
      DROP COLUMN IF EXISTS revoke_hash
  `.execute(db)

  await sql`DROP INDEX IF EXISTS idx_proyectofinanciero_contenido_cristiano`.execute(db)
  await sql`
    ALTER TABLE cor1440_gen_proyectofinanciero
      DROP COLUMN IF EXISTS contenido_cristiano
  `.execute(db)

  await sql`
    ALTER TABLE usuario
      DROP COLUMN IF EXISTS mostrar_cursos_publico,
      DROP COLUMN IF EXISTS mostrar_cursos_cristianos_publico
  `.execute(db)
}
