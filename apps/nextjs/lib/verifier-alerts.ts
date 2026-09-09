import type { Kysely } from 'kysely'

// Alertas in-app a los verificadores (REQ/223 — patrón "billetera del backend
// como intermediaria"): cuando una operación deja fondos pendientes en la
// billetera del backend (p. ej. un reenvío de donación que no logró hash), se
// notifica a TODOS los verificadores configurados; cuando la operación se
// resuelve, las notificaciones de ese evento se marcan como leídas para todos
// (un solo update por type + ref_key).
//
// Mecanismo genérico: cada operación usa su propio `type` y `refKey`
// (idempotente por usuario); reutilizable por otros motores (rewards, core)
// vía deps D2 — el motor no conoce la lista de verificadores ni la tabla de
// notificaciones.

function verifierWallets(): string[] {
  return (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
}

export interface VerifierAlertEvent {
  type: string
  refKey: string
  title: string
  content: string
  link?: string
}

export interface VerifierAlertRef {
  type: string
  refKey: string
}

export async function getVerifierUserIds(db: Kysely<any>): Promise<number[]> {
  const wallets = verifierWallets()
  if (wallets.length === 0) return []
  const rows = await db
    .selectFrom('billetera_usuario')
    .select('usuario_id')
    .where('billetera', 'in', wallets)
    .execute()
  return Array.from(new Set(rows.map((r) => Number(r.usuario_id)))).filter((id) => id > 0)
}

/**
 * Notifica a todos los verificadores. Idempotente: no duplica si el mismo
 * evento (type + refKey) ya se insertó para ese usuario (los reintentos de una
 * operación no deben spamear). Devuelve cuántas notificaciones se insertaron.
 */
export async function raiseVerifierAlert(db: Kysely<any>, evt: VerifierAlertEvent): Promise<number> {
  const ids = await getVerifierUserIds(db)
  let inserted = 0
  for (const usuarioId of ids) {
    const dup = await db
      .selectFrom('notifications')
      .select('id')
      .where('usuario_id', '=', usuarioId)
      .where('type', '=', evt.type)
      .where('ref_key', '=', evt.refKey)
      .limit(1)
      .execute()
    if (dup.length > 0) continue
    await db
      .insertInto('notifications')
      .values({
        usuario_id: usuarioId,
        type: evt.type,
        title: evt.title.slice(0, 200),
        content: evt.content,
        link: evt.link || '',
        ref_key: evt.refKey,
        is_read: false,
        created_at: new Date(),
      })
      .execute()
    inserted++
  }
  return inserted
}

/**
 * Marca como leída — para TODOS los destinatarios — la alerta type + refKey
 * (la operación se resolvió: reenvío completado, etc.).
 */
export async function resolveVerifierAlert(db: Kysely<any>, ref: VerifierAlertRef): Promise<number> {
  const res: any = await db
    .updateTable('notifications')
    .set({ is_read: true })
    .where('type', '=', ref.type)
    .where('ref_key', '=', ref.refKey)
    .execute()
  const n = Number(res?.numUpdatedRows ?? 0)
  return Number.isNaN(n) ? 0 : n
}
