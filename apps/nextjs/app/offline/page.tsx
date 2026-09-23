'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { listGuides, type CachedGuide } from '@/lib/offline-guide-db'
import { belongsToWallet, listDownloadedCourses, type DownloadedCourse } from '@/lib/offline-course-db'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

/**
 * Página de respaldo cuando una navegación no está en ninguna caché
 * (`fallbacks.document = '/offline'`).
 *
 * R-#240/R-#241: además de reintentar, lista las guías que este dispositivo ya
 * tiene guardadas (IndexedDB) y enlaza a ellas. Antes el único enlace era a
 * `/{lang}` ("los cursos que ya visitaste"), que sin conexión no está cacheado y
 * dejaba al usuario en un callejón sin salida.
 *
 * R-#256: lista primero los **cursos descargados completos** (con todas sus
 * guías, hayan sido abiertas o no). Un curso de pago descargado con otra
 * billetera no se lista, y un curso con `contenido_sensible` solo existe en el
 * store mientras el interruptor de privacidad de R-#259 está encendido (el
 * registro se borra al apagarlo): así el teléfono no revela la afiliación por sí
 * solo.
 */
export default function OfflinePage() {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang === 'es' ? 'es' : 'en'
  const [guides, setGuides] = useState<CachedGuide[] | null>(null)
  const [courses, setCourses] = useState<DownloadedCourse[] | null>(null)
  const { address, sessionAddress } = useAuthAddress()
  const wallet = address || sessionAddress || null

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'You are offline',
      message: 'Your progress is saved and will sync when the connection returns.',
      retry: 'Retry',
      courses: 'Go to the courses you already visited',
      downloaded: 'Courses downloaded on this device',
      saved: 'Guides saved on this device',
      noSaved: 'You have not opened any guide online yet, so there is nothing to read offline. Open a guide while connected and it will be saved here.',
      refreshed: 'Updated',
    },
    es: {
      title: 'Estás sin conexión',
      message: 'Tu progreso está guardado y se sincronizará cuando vuelva la conexión.',
      retry: 'Reintentar',
      courses: 'Ir a los cursos que ya visitaste',
      downloaded: 'Cursos descargados en este dispositivo',
      saved: 'Guías guardadas en este dispositivo',
      noSaved: 'Todavía no abriste ninguna guía con conexión, así que no hay nada que leer sin conexión. Abre una guía conectado y quedará guardada aquí.',
      refreshed: 'Actualizado',
    },
  }), [lang])

  useEffect(() => {
    let cancelled = false
    void listGuides()
      .then((items) => { if (!cancelled) setGuides(items) })
      .catch(() => { if (!cancelled) setGuides([]) })
    void listDownloadedCourses()
      .then((items) => { if (!cancelled) setCourses(items) })
      .catch(() => { if (!cancelled) setCourses([]) })
    return () => { cancelled = true }
  }, [])

  // Un curso de pago solo se lee con la billetera que lo descargó (R-#256 §3.5).
  const readableCourses = (courses ?? []).filter((course) => belongsToWallet(course, wallet))
  // Las guías de un curso descargado ya se listan dentro del curso.
  const downloadedKeys = new Set(
    readableCourses.flatMap((course) => course.guides.map((guide) => `${course.key}/${guide.suffix}`)),
  )
  const looseGuides = (guides ?? []).filter((guide) => !downloadedKeys.has(guide.key))

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

      {readableCourses.length > 0 && (
        <div className="mt-10 text-left">
          <p className="mb-2 text-sm font-medium" data-testid="offline-downloaded-title">{t('downloaded')}</p>
          <ul className="space-y-3" data-testid="offline-downloaded-courses">
            {readableCourses.map((course) => (
              <li key={course.key} data-testid={`offline-course-${course.key}`}>
                <p className="font-semibold">
                  {course.titulo || course.prefix}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {t('refreshed')}: {new Date(course.downloadedAt).toLocaleDateString(lang === 'es' ? 'es' : 'en')}
                  </span>
                </p>
                <ul className="ml-4 mt-1 space-y-1">
                  {course.guides.map((guide) => (
                    <li key={guide.suffix}>
                      <Link
                        href={`/${course.key}/${guide.suffix}`}
                        className="underline"
                        data-testid={`offline-guide-${course.key}/${guide.suffix}`}
                      >
                        /{course.key}/{guide.suffix}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {looseGuides.length > 0 && (
        <div className="mt-10 text-left">
          <p className="mb-2 text-sm font-medium" data-testid="offline-saved-title">{t('saved')}</p>
          <ul className="space-y-1" data-testid="offline-saved-guides">
            {looseGuides.map((guide) => (
              <li key={guide.key}>
                <Link href={`/${guide.key}`} className="underline" data-testid={`offline-guide-${guide.key}`}>
                  /{guide.key}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {guides !== null && guides.length === 0 && readableCourses.length === 0 && (
        <p className="mt-10 text-sm text-gray-600" data-testid="offline-no-saved-guides">
          {t('noSaved')}
        </p>
      )}
    </main>
  )
}
