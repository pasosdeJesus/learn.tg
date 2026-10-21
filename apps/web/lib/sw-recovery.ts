/**
 * Recuperación del cliente cuando un shell viejo del service worker apunta a
 * chunks que el deploy ya removió (https://github.com/pasosdeJesus/learn.tg/issues/272 §10).
 *
 * La causa se corrigió en `next.config.ts` (los shells `/en` y `/es` ya no se
 * precachean sin revisión), pero una red lenta todavía puede servir la copia
 * cacheada por el timeout del NetworkFirst. Estos dos guardas hacen que la página
 * se recupere sola en vez de quedarse en "This page couldn't load":
 *
 * - recargar una vez cuando cambia el controller del service worker (solo si ya
 *   había uno: si no, la primera instalación recargaría en vano);
 * - recargar una vez ante un `ChunkLoadError`, con marca en `sessionStorage` para
 *   no entrar en bucle si el fallo es persistente.
 */

export const CHUNK_RELOAD_KEY = 'learn.tg.chunkReloadAt'

/** Ventana mínima entre dos recargas por chunk: evita el bucle. */
export const CHUNK_RELOAD_WINDOW_MS = 10_000

export function isChunkLoadError(message: unknown): boolean {
  const text =
    typeof message === 'string'
      ? message
      : String((message as { message?: unknown } | null | undefined)?.message ?? message ?? '')
  return /ChunkLoadError|Loading chunk\s+\S+\s+failed|Loading CSS chunk/i.test(text)
}

export function shouldReloadForChunkError(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined,
  now: number = Date.now(),
  windowMs: number = CHUNK_RELOAD_WINDOW_MS,
): boolean {
  if (!storage) return true
  try {
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY))
    if (Number.isFinite(last) && last > 0 && now - last < windowMs) return false
    storage.setItem(CHUNK_RELOAD_KEY, String(now))
    return true
  } catch {
    return true
  }
}
