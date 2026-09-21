'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { listGuides, type CachedGuide } from '@/lib/offline-guide-db'

/**
 * Página de respaldo cuando una navegación no está en ninguna caché
 * (`fallbacks.document = '/offline'`).
 *
 * R-#240/R-#241: además de reintentar, lista las guías que este dispositivo ya
 * tiene guardadas (IndexedDB) y enlaza a ellas. Antes el único enlace era a
 * `/{lang}` ("los cursos que ya visitaste"), que sin conexión no está cacheado y
 * dejaba al usuario en un callejón sin salida.
 */
export default function OfflinePage() {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang === 'es' ? 'es' : 'en'
  const [guides, setGuides] = useState<CachedGuide[] | null>(null)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'You are offline',
      message: 'Your progress is saved and will sync when the connection returns.',
      retry: 'Retry',
      courses: 'Go to the courses you already visited',
      saved: 'Guides saved on this device',
      noSaved: 'You have not opened any guide online yet, so there is nothing to read offline. Open a guide while connected and it will be saved here.',
    },
    es: {
      title: 'Estás sin conexión',
      message: 'Tu progreso está guardado y se sincronizará cuando vuelva la conexión.',
      retry: 'Reintentar',
      courses: 'Ir a los cursos que ya visitaste',
      saved: 'Guías guardadas en este dispositivo',
      noSaved: 'Todavía no abriste ninguna guía con conexión, así que no hay nada que leer sin conexión. Abre una guía conectado y quedará guardada aquí.',
    },
  }), [lang])

  useEffect(() => {
    let cancelled = false
    void listGuides()
      .then((items) => { if (!cancelled) setGuides(items) })
      .catch(() => { if (!cancelled) setGuides([]) })
    return () => { cancelled = true }
  }, [])

  return (
    <main className="max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
      <p className="mb-8">{t('message')}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded bg-emerald-700 text-white"
        >
          {t('retry')}
        </button>
        <Link href={`/${lang}`} className="px-4 py-2 rounded border border-emerald-700">
          {t('courses')}
        </Link>
      </div>

      {guides && guides.length > 0 && (
        <div className="mt-10 text-left">
          <p className="mb-2 text-sm font-medium" data-testid="offline-saved-title">{t('saved')}</p>
          <ul className="space-y-1" data-testid="offline-saved-guides">
            {guides.map((guide) => (
              <li key={guide.key}>
                <Link href={`/${guide.key}`} className="underline" data-testid={`offline-guide-${guide.key}`}>
                  /{guide.key}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {guides !== null && guides.length === 0 && (
        <p className="mt-10 text-sm text-gray-600" data-testid="offline-no-saved-guides">
          {t('noSaved')}
        </p>
      )}
    </main>
  )
}
