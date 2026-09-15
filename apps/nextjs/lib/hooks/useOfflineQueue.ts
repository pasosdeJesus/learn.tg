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
          sent += 1
          continue
        }
        if (response.status >= 500) {
          await registerAttempt(item.id)
          continue
        }
        // Error de cliente (sesión vencida, respuesta ya registrada, etc.):
        // reintentar no ayuda, pero no se descarta en el primer intento.
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

  return { isOffline, pending, enqueue, flush, refresh }
}
