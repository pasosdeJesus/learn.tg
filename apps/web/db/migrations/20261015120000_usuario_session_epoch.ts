import { Kysely, sql } from 'kysely'

// R-#250 / R-#265 §3.8 — la sesión identifica al **usuario**, no a la billetera, y
// puede revocarse entera con un solo UPDATE.
// https://github.com/pasosdeJesus/learn.tg/issues/265
//
// `usuario.session_epoch` (aditiva, default 0) se copia al JWT al iniciar sesión;
// `lib/authenticateUser.ts` rechaza el token cuya época no coincide con la fila. Subir
// la época (`UPDATE usuario SET session_epoch = session_epoch + 1 WHERE id = …`) corta
// **todas** las sesiones de esa persona (teléfono perdido o compartido). Es una
// extensión propia de learn.tg, como `learningscore`: no se declara en el motor `msip`.
// Aditiva e idempotente (`IF NOT EXISTS`), reversible.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS session_epoch integer NOT NULL DEFAULT 0`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE usuario DROP COLUMN IF EXISTS session_epoch`.execute(db)
}
