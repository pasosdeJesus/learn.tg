import type { Kysely } from 'kysely'

/**
 * R-#242: aviso duradero del resultado de una respuesta resuelta sin conexión.
 *
 * La cola se drena cuando el estudiante recupera la red, y para entonces puede estar
 * en cualquier página, o haber cerrado la app y volver más tarde: el aviso en
 * pantalla (`components/OfflineQueueSync.tsx`) no llega en esos casos. Por eso el
 * resultado queda además en `notifications` (R-#162 fase 1) y la campana lo muestra.
 *
 * Idempotente por `type` + `ref_key` (el momento en que se guardó la respuesta),
 * igual que `raiseVerifierAlert`: un reintento de la cola no duplica el aviso.
 */

export const OFFLINE_ANSWER_TYPE = 'offline_answer'

export interface OfflineAnswerOutcome {
  /** Idioma de la entrega guardada (el `lang` del payload del crucigrama). */
  lang: string
  /** Ruta del crucigrama, para que el aviso lleve al sitio correcto. */
  path?: string | null
  /** Palabras con problema (1-based), tal como las devuelve el motor. */
  mistakesInCW?: number[]
  scholarshipUsdt?: number
  scholarshipSlearn?: number
  /** Mensaje del servidor (cooldown, sin vault, etc.). */
  message?: string
  /** Marca del cliente: cuándo se guardó la respuesta sin conexión. */
  offlineSavedAt: number
}

export async function recordOfflineAnswerNotice(
  db: Kysely<any>,
  usuarioId: number,
  outcome: OfflineAnswerOutcome,
): Promise<boolean> {
  const refKey = `${OFFLINE_ANSWER_TYPE}:${outcome.offlineSavedAt}`

  const duplicate = await db
    .selectFrom('notifications')
    .select('id')
    .where('usuario_id', '=', usuarioId)
    .where('type', '=', OFFLINE_ANSWER_TYPE)
    .where('ref_key', '=', refKey)
    .limit(1)
    .execute()
  if (duplicate.length > 0) return false

  const es = String(outcome.lang || '').toLowerCase().startsWith('es')
  const usdt = Number(outcome.scholarshipUsdt ?? 0)
  const slearn = Number(outcome.scholarshipSlearn ?? 0)
  const mistakes = (outcome.mistakesInCW ?? []).filter((n) => Number.isFinite(n))
  const title = es ? 'Tu respuesta guardada fue revisada' : 'Your saved answer was reviewed'

  let content: string
  if (mistakes.length > 0) {
    const words = mistakes.map((n) => `#${n}`).join(', ')
    content = es
      ? `Hay palabras por corregir: ${words}. Vuelve a intentarlo.`
      : `There are words to fix: ${words}. Try again.`
  } else if (usdt > 0 || slearn > 0) {
    content = es
      ? `¡Correcta! Recibiste ${usdt.toFixed(2)} USDT + ${slearn.toFixed(2)} SLEARN.`
      : `Correct! You received ${usdt.toFixed(2)} USDT + ${slearn.toFixed(2)} SLEARN.`
  } else {
    const detail = String(outcome.message || '').replace(/\s+/g, ' ').trim().slice(0, 180)
    const prefix = es ? 'Correcta, sin beca nueva.' : 'Correct, no new scholarship.'
    content = detail ? `${prefix} ${detail}` : prefix
  }

  await db
    .insertInto('notifications')
    .values({
      usuario_id: usuarioId,
      type: OFFLINE_ANSWER_TYPE,
      title: title.slice(0, 200),
      content: content.slice(0, 500),
      link: outcome.path || '',
      ref_key: refKey,
      is_read: false,
      created_at: new Date(),
    })
    .execute()

  return true
}
