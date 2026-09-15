'use client'

import { useCallback, useState } from 'react'
import { deleteGuide, getGuide, saveGuide } from '@/lib/offline-guide-db'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'

export interface UseCachedGuideResult {
  isOffline: boolean
  isFromCache: boolean
  markFromCache: (value: boolean) => void
  getCached: () => Promise<string | null>
  save: (markdown: string) => Promise<void>
  remove: () => Promise<void>
}

/**
 * Offline copy of one guide (R-#241).
 *
 * The page saves the Markdown it fetched while online and falls back to it when
 * the request fails or the browser is offline, so a guide that was already
 * visited stays readable.
 */
export function useCachedGuide(key: string): UseCachedGuideResult {
  const { isOffline } = useOfflineStatus()
  const [isFromCache, setIsFromCache] = useState(false)

  const getCached = useCallback(async () => {
    const cached = await getGuide(key)
    return cached?.markdown ?? null
  }, [key])

  const save = useCallback(async (markdown: string) => {
    if (!markdown) return
    await saveGuide(key, markdown)
  }, [key])

  const remove = useCallback(async () => {
    await deleteGuide(key)
  }, [key])

  return {
    isOffline,
    isFromCache,
    markFromCache: setIsFromCache,
    getCached,
    save,
    remove,
  }
}
