'use client'

import { useCallback, useEffect, useState } from 'react'
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
}

/**
 * Small queue for mutations that failed because the device was offline
 * (R-#241/R-#242): they are replayed, in order, as soon as the browser reports
 * that the connection is back.
 *
 * The session cookie travels with the request, so a replayed submission is
 * authenticated exactly like the original one (R-#233 Phase 2).
 */
export function useOfflineQueue(): UseOfflineQueueResult {
  const { isOffline } = useOfflineStatus()
  const [pending, setPending] = useState(0)
  const [lastRejection, setLastRejection] = useState<UseOfflineQueueResult['lastRejection']>(null)

  const refresh = useCallback(async () => {
    setPending(await pendingCount())
  }, [])

  const enqueue = useCallback(async (url: string, body: unknown) => {
    await enqueueSubmission(url, body)
    await refresh()
  }, [refresh])

  const flush = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0
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
          // Un envío válido borra el aviso del rechazo anterior.
          setLastRejection(null)
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
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (isOffline) return
    void flush()
  }, [isOffline, flush])

  const clearLastRejection = useCallback(() => setLastRejection(null), [])

  return { isOffline, pending, enqueue, flush, refresh, lastRejection, clearLastRejection }
}
