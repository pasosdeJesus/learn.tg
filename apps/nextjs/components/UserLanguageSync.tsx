'use client'

import { useEffect, useRef } from 'react'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'

/**
 * Keeps `usuario.idioma` in sync with the language the user is currently
 * browsing in (the `[lang]` URL segment). Runs once per (address, lang) so the
 * pastor bonus notification is localized to the user's preferred language.
 */
export function UserLanguageSync({ lang }: { lang: string }) {
  const { wallet: address, ready, isAuthenticated, authedPatch } = useAuthedApi()
  const lastSynced = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !address || !ready) return
    const normalized = lang === 'es' ? 'es' : 'en'
    const key = `${address.toLowerCase()}:${normalized}`
    if (lastSynced.current === key) return

    const sync = async () => {
      try {
        await authedPatch('/api/profile', { idioma: normalized })
        lastSynced.current = key
      } catch {
        // ignore transient errors
      }
    }
    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, address, isAuthenticated, ready])

  return null
}
