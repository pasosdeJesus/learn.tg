'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { listDownloadedCourses } from '@/lib/offline-course-db'
import { downloadAllAccessible, listAccessibleCourses, type SyncResult } from '@/lib/offline-course-download'

/**
 * Guarda **todos los cursos accesibles** en el dispositivo para leerlos sin
 * conexión (https://github.com/pasosdeJesus/learn.tg/issues/256).
 *
 * El operador reportó el 2026-09-23 que offline solo estaba la guía que había
 * visitado: la descarga era por curso y a pedido. Ahora la app sincroniza sola,
 * con conexión, todo lo que el estudiante puede leer:
 *
 * - cursos gratuitos, siempre;
 * - cursos de pago, solo si esta billetera los compró;
 * - cursos de contenido sensible, solo con el interruptor de R-#259 encendido
 *   (el teléfono no debe revelar la afiliación por sí solo).
 *
 * Es idempotente y barato: las copias al día se omiten, así que puede correr cada
 * vez que la app abre con conexión. `OfflineLibrarySync` corre sola (montada en el
 * layout); `OfflineDownloadAll` es el control visible con progreso que pide el
 * operador ("en ninguna parte vi botón para descargar todo").
 */

const SYNC_STAMP_KEY = 'learn.tg.offlineLibrarySyncedAt'
// No volver a sincronizar en cada navegación: con copias al día ya es barato, pero
// no hace falta consultar el catálogo en cada paso de página.
const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000

export interface OfflineLibrarySyncState {
  syncing: boolean
  done: number
  total: number
  label: string
  last: SyncResult | null
  savedCount: number
  error: string
  sync: () => Promise<SyncResult | null>
}

export function useOfflineLibrarySync(lang: string): OfflineLibrarySyncState {
  const { authedGet, ready, wallet, mismatch } = useAuthedApi()
  const [syncing, setSyncing] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [label, setLabel] = useState('')
  const [last, setLast] = useState<SyncResult | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState('')
  const running = useRef(false)

  const refreshSaved = useCallback(async () => {
    try {
      setSavedCount((await listDownloadedCourses()).length)
    } catch {
      setSavedCount(0)
    }
  }, [])

  useEffect(() => { void refreshSaved() }, [refreshSaved])

  const sync = useCallback(async () => {
    if (running.current) return null
    running.current = true
    setSyncing(true)
    setError('')
    setDone(0)
    try {
      const result = await downloadAllAccessible(authedGet, {
        lang,
        wallet,
        authenticated: !!wallet,
        onProgress: (progress) => {
          setDone(progress.done)
          setTotal(progress.total)
          setLabel(progress.label)
        },
      })
      setLast(result)
      await refreshSaved()
      try { sessionStorage.setItem(SYNC_STAMP_KEY, String(Date.now())) } catch { /* almacenamiento bloqueado */ }
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setSyncing(false)
      running.current = false
    }
  }, [authedGet, lang, wallet, refreshSaved])

  return { syncing, done, total, label, last, savedCount, error, sync }
}

/** Cuántos cursos accesibles hay y cuántos no (para poder decirlo al usuario). */
export async function countAccessible(
  get: ReturnType<typeof useAuthedApi>['authedGet'],
  lang: string,
  authenticated: boolean,
): Promise<{ total: number; accessible: number; privacy: number; notPurchased: number }> {
  const { courses, skipped, total } = await listAccessibleCourses(get, { lang, authenticated })
  return {
    total,
    accessible: courses.length,
    privacy: skipped.filter((item) => item.reason === 'privacy').length,
    notPurchased: skipped.filter((item) => item.reason === 'not-purchased').length,
  }
}

/**
 * Sincronización automática (invisible). Se monta en el layout para que las guías
 * queden guardadas aunque el estudiante nunca abra la lista de cursos.
 */
export function OfflineLibrarySync({ lang }: { lang: string }) {
  const { sync, syncing } = useOfflineLibrarySync(lang)
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current || syncing) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    // Respetar el ahorro de datos y las redes muy lentas: la sincronización baja
    // todas las guías accesibles (decenas de peticiones) y en un teléfono con plan
    // limitado conviene dejarla al botón explícito.
    const connection = (navigator as any)?.connection
    if (connection?.saveData === true) return
    if (['slow-2g', '2g'].includes(String(connection?.effectiveType || ''))) return
    let lastRun = 0
    try { lastRun = Number(sessionStorage.getItem(SYNC_STAMP_KEY) || 0) } catch { /* idem */ }
    if (lastRun && Date.now() - lastRun < AUTO_SYNC_INTERVAL_MS) return
    attempted.current = true
    void sync()
  }, [sync, syncing])

  return null
}

/** Control visible: botón, progreso y resumen de lo que quedó guardado. */
export function OfflineDownloadAll({ lang }: { lang: string }) {
  const { syncing, done, total, label, last, savedCount, error, sync } = useOfflineLibrarySync(lang)
  const { toast } = useToast()
  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Courses on this device',
      ready: 'saved for reading offline',
      sync: 'Download all my courses',
      syncing: 'Saving',
      waiting: 'Waiting for a connection',
      result: 'Finished',
      privacy: 'not published (Christian content)',
      notPurchased: 'not purchased',
      failed: 'could not be saved',
      error: 'Could not save the courses',
    },
    es: {
      title: 'Cursos en este dispositivo',
      ready: 'guardados para leer sin conexión',
      sync: 'Descargar todos mis cursos',
      syncing: 'Guardando',
      waiting: 'Esperando conexión',
      result: 'Terminado',
      privacy: 'sin publicar (contenido cristiano)',
      notPurchased: 'sin comprar',
      failed: 'no se pudieron guardar',
      error: 'No se pudieron guardar los cursos',
    },
  }), [lang])

  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  const onSync = useCallback(async () => {
    if (offline) {
      toast({ title: t('waiting') })
      return
    }
    const result = await sync()
    if (result) {
      toast({
        title: `${t('result')}: ${result.downloaded.length} · ${t('ready')}`,
      })
    } else {
      toast({ title: t('error'), variant: 'destructive' })
    }
  }, [offline, sync, t, toast])

  return (
    <div
      className="mx-auto max-w-3xl px-4 py-3 text-sm text-gray-700"
      data-testid="offline-download-all"
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="text-gray-600">
          {t('title')}: <span className="font-semibold">{savedCount}</span> {t('ready')}
        </span>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="rounded bg-emerald-700 px-3 py-1.5 text-white disabled:opacity-50"
        >
          {syncing && total > 0
            ? `${t('syncing')} ${done}/${total}${label ? ` (${label})` : ''}`
            : t('sync')}
        </button>
      </div>

      {last && (
        <p className="mt-1 text-center text-xs text-gray-500">
          {t('result')}: {last.downloaded.length} · {t('ready')}
          {last.skipped.some((item) => item.reason === 'privacy') &&
            ` · ${last.skipped.filter((item) => item.reason === 'privacy').length} ${t('privacy')}`}
          {last.skipped.some((item) => item.reason === 'not-purchased') &&
            ` · ${last.skipped.filter((item) => item.reason === 'not-purchased').length} ${t('notPurchased')}`}
          {last.failed.length > 0 && ` · ${last.failed.length} ${t('failed')}`}
        </p>
      )}

      {error && <p className="mt-1 text-center text-xs text-red-700">{t('error')}</p>}
    </div>
  )
}
