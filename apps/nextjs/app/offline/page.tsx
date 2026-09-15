'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createComponentT } from '@/lib/hooks/useTranslation'

export default function OfflinePage() {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang === 'es' ? 'es' : 'en'

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'You are offline',
      message: 'Your progress is saved and will sync when the connection returns.',
      retry: 'Retry',
      courses: 'Go to the courses you already visited',
    },
    es: {
      title: 'Estás sin conexión',
      message: 'Tu progreso está guardado y se sincronizará cuando vuelva la conexión.',
      retry: 'Reintentar',
      courses: 'Ir a los cursos que ya visitaste',
    },
  }), [lang])

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
    </main>
  )
}
