'use client'

import { useEffect, useRef } from 'react'
import { getCsrfToken } from 'next-auth/react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

/**
 * Keeps `usuario.idioma` in sync with the language the user is currently
 * browsing in (the `[lang]` URL segment). Runs once per (address, lang) so the
 * pastor bonus notification is localized to the user's preferred language.
 */
export function UserLanguageSync({ lang }: { lang: string }) {
  const { address, isAuthenticated } = useAuthAddress()
  const lastSynced = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !address) return
    const normalized = lang === 'es' ? 'es' : 'en'
    const key = `${address.toLowerCase()}:${normalized}`
    if (lastSynced.current === key) return

    const sync = async () => {
      try {
        const token = localStorage.getItem('learn.tg.authToken') || (await getCsrfToken())
        const res = await fetch(`/api/profile?walletAddress=${address}&token=${token}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idioma: normalized }),
        })
        if (res.ok) lastSynced.current = key
      } catch {
        // ignore transient errors
      }
    }
    sync()
  }, [lang, address, isAuthenticated])

  return null
}
