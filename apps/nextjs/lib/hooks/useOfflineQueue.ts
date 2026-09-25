'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  dequeueSubmission,
  enqueueSubmission,
  listPending,
  pendingCount,
  registerAttempt,
} from '@/lib/offline-queue-db'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'

export interface UseOfflineQueueResult {
  isOffline: boolean
  pending: number
  enqueue: (url: string, body: unknown) => Promise<void>
  flush: () => Promise<number>
  refresh: () => Promise<void>
  /**
   * Último rechazo del servidor al reproducir una respuesta guardada (R-#242):
   * 4xx significa que reintentar no ayuda, así que la página debe contarlo (p. ej.
   * "necesitas 50 puntos") en vez de dejarlo en la cola en silencio.
   */
  lastRejection: { url: string; status: number; message?: string } | null
  clearLastRejection: () => void
  /**
   * Última respuesta **procesada** del servidor al reproducir algo guardado
   * (R-#242). La página del crucigrama ya muestra el resultado en el momento; este
   * dato lo usa el aviso global (`components/OfflineQueueSync.tsx`) para que el
   * estudiante se entere aunque haya dejado la página al reconectar (el operador
   * lo reportó el 2026-09-23: "no se ve actualización alguna ni notificación").
   */
  lastResult: { url: string; body: any } | null
  clearLastResult: () => void
}

/**
 * Small queue for mutations that failed because the device was offline
 * (R-#241/R-#242): they are replayed, in order, as soon as the browser reports
 * that the connection is back.
 *
 * The session cookie travels with the request, so a replayed submission is
 * authenticated exactly like the original one (R-#233 Phase 2).
 */
/**
 * Un solo drenado en vuelo para toda la app (compartido por todas las instancias
 * del hook). Ver el comentario dentro de `flush`.
 */
let activeFlush: Promise<number> | null = null

/**
 * Nombre del candado **entre pestañas** (`navigator.locks`). `activeFlush` sólo cubre una
 * pestaña: el estado de módulo es por *realm*, así que con dos pestañas abiertas las dos
 * drenaban la misma respuesta guardada (medido con el spec de dos cursos contra el sitio
 * de desarrollo, 2026-09-25: la segunda entrega recibía el enfriamiento de 24 h porque la
 * primera ya había pagado la beca, y el mismo envío se procesaba dos veces).
 */
const FLUSH_LOCK = 'learn-tg-offline-drain'

interface WebLocksLike {
  request(
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => Promise<unknown>,
  ): Promise<unknown>
}

/**
 * Corre `fn` con el candado entre pestañas. Si otra pestaña lo tiene, devuelve `skipped`
 * sin enviar nada (esa otra pestaña ya está drenando la misma cola). Sin Web Locks
 * (navegadores viejos) se comporta como antes: `activeFlush` lo serializa dentro de la
 * pestaña.
 */
async function withCrossTabLock<T>(fn: () => Promise<T>, skipped: T): Promise<T> {
  const locks = (globalThis.navigator as unknown as { locks?: WebLocksLike } | undefined)?.locks
  if (!locks?.request) return fn()
  const result = await locks.request(FLUSH_LOCK, { ifAvailable: true }, async (lock) => {
    if (!lock) return undefined
    return fn()
  })
  return result === undefined ? skipped : (result as T)
}

/**
 * Contador de pendientes compartido por todas las instancias (R-#242).
 *
 * El hook vive en el layout (`OfflineQueueSync`) y también en la página del
 * crucigrama, y el drenado es único para toda la app (`activeFlush`): la
 * instancia que drena no es necesariamente la que muestra el contador. Con un
 * `useState` por instancia la página seguía mostrando "1 respuesta pendiente" con
 * la cola ya vacía en IndexedDB (medido en E2E el 2026-09-24). El contador es un
 * estado de módulo observable, así que todas las instancias coinciden con el
 * store.
 */
let sharedPending = 0
const pendingListeners = new Set<() => void>()

function setSharedPending(value: number) {
  if (value === sharedPending) return
  sharedPending = value
  for (const listener of pendingListeners) listener()
}

function subscribePending(listener: () => void) {
  pendingListeners.add(listener)
  return () => {
    pendingListeners.delete(listener)
  }
}

function getPendingSnapshot() {
  return sharedPending
}

export function useOfflineQueue(): UseOfflineQueueResult {
  const { isOffline } = useOfflineStatus()
  // R-#242: contador compartido (ver `sharedPending`), no un estado por instancia.
  const pending = useSyncExternalStore(subscribePending, getPendingSnapshot, () => 0)
  const [lastRejection, setLastRejection] = useState<UseOfflineQueueResult['lastRejection']>(null)
  const [lastResult, setLastResult] = useState<UseOfflineQueueResult['lastResult']>(null)

  const refresh = useCallback(async () => {
    setSharedPending(await pendingCount())
  }, [])

  const enqueue = useCallback(async (url: string, body: unknown) => {
    await enqueueSubmission(url, body)
    await refresh()
  }, [refresh])

  const flush = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0
    // Un solo drenado a la vez en toda la app: el hook vive en el layout
    // (`OfflineQueueSync`, R-#242) y también en la página del crucigrama, y dos
    // instancias enviando la misma respuesta guardada podrían procesarla dos veces
    // (doble beca). Las demás instancias esperan el mismo resultado.
    // Con **dos pestañas** ese candado no basta (es estado de módulo, por *realm*): el
    // candado de `navigator.locks` cubre el caso entre pestañas y la segunda no envía
    // nada (el PWA abierto y una pestaña del navegador a la vez).
    if (activeFlush) return activeFlush
    const run = (async () =>
      withCrossTabLock(async () => {
        const items = await listPending()
        let sent = 0
        for (const item of items) {
          try {
            const response = await fetch(item.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.body),
            })
            if (response.ok) {
              await dequeueSubmission(item.id)
              // Un envío válido borra el aviso del rechazo anterior y deja el
              // resultado para que se pueda contar fuera de la página (R-#242).
              setLastRejection(null)
              try {
                setLastResult({ url: item.url, body: await response.clone().json() })
              } catch {
                setLastResult({ url: item.url, body: null })
              }
              sent += 1
              continue
            }
            if (response.status >= 500) {
              await registerAttempt(item.id)
              continue
            }
            // Error de cliente (sesión vencida, perfil por debajo del mínimo, respuesta
            // ya registrada, etc.): reintentar no ayuda, pero no se descarta en el
            // primer intento. R-#242: se guarda el motivo para que la página lo cuente.
            let message: string | undefined
            try {
              const body = await response.clone().json()
              message = body?.error || body?.message
            } catch {
              // respuesta sin JSON: queda el código de estado
            }
            setLastRejection({ url: item.url, status: response.status, message })
            await registerAttempt(item.id)
          } catch {
            await registerAttempt(item.id)
            break
          }
        }
        await refresh()
        return sent
      }, 0))()
    activeFlush = run.finally(() => { activeFlush = null })
    return activeFlush
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (isOffline) return
    void flush()
  }, [isOffline, flush])

  const clearLastRejection = useCallback(() => setLastRejection(null), [])
  const clearLastResult = useCallback(() => setLastResult(null), [])

  return { isOffline, pending, enqueue, flush, refresh, lastRejection, clearLastRejection, lastResult, clearLastResult }
}
