'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks whether the browser is offline (R-#240).
 *
 * Starts as `false` (the server has no `navigator`) and syncs on mount, so it
 * never causes a hydration mismatch; then follows the `online`/`offline`
 * events.
 */
export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return

    const update = () => setIsOffline(!navigator.onLine)
    update()

    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return { isOffline }
}
