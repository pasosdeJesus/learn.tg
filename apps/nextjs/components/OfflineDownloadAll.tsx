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

// Una sola sincronización a la vez en toda la app: el layout (`OfflineLibrarySync`)
// y el control de la lista de cursos comparten el catálogo y la misma billetera;
// dos corridas en paralelo descargarían lo mismo dos veces.
let syncInFlight = false

/**
 * Por qué la sincronización automática está en pausa. `saveData` es el ahorro de datos
 * del navegador y `slow` una red 2G: bajar decenas de guías con un plan limitado no es
 * una decisión que la app deba tomar sola.
 */
export type ConnectionHold = 'saveData' | 'slow' | null

/**
 * El freno de conexión actual (decisión del operador, 2026-09-25: el freno **no** puede
 * ser silencioso). Se lee en el momento para que el control visible pueda decirlo y el
 * enlace "Check now" siga disponible como acción explícita del estudiante.
 */
export function connectionHold(): ConnectionHold {
  if (typeof navigator === 'undefined') return null
  const connection = (navigator as any)?.connection
  if (!connection) return null
  if (connection.saveData === true) return 'saveData'
  if (['slow-2g', '2g'].includes(String(connection.effectiveType || ''))) return 'slow'
  return null
}

export interface OfflineLibrarySyncState {
  syncing: boolean
  done: number
  total: number
  /** Cursos que de verdad faltan (ni al día ni caducados). El aviso solo sale si es > 0. */
  pending: number
  label: string
  last: SyncResult | null
  savedCount: number
  error: string
  /** La identidad (sesión/billetera) ya está resuelta: no se lanzan peticiones anónimas. */
  ready: boolean
  /** Motivo por el que la sincronización automática está en pausa (`null` si no lo está). */
  hold: ConnectionHold
  sync: () => Promise<SyncResult | null>
}

export function useOfflineLibrarySync(lang: string): OfflineLibrarySyncState {
  const { authedGet, ready, wallet, mismatch } = useAuthedApi()
  const [syncing, setSyncing] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState(0)
  const [label, setLabel] = useState('')
  const [last, setLast] = useState<SyncResult | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState('')
  const [hold, setHold] = useState<ConnectionHold>(null)

  // El freno se relee cuando el navegador cambia de red (o el usuario apaga el ahorro de
  // datos): así el aviso desaparece y la sincronización automática arranca sola.
  useEffect(() => {
    const read = () => setHold(connectionHold())
    read()
    const connection = (navigator as any)?.connection
    connection?.addEventListener?.('change', read)
    return () => connection?.removeEventListener?.('change', read)
  }, [])

  const refreshSaved = useCallback(async () => {
    try {
      setSavedCount((await listDownloadedCourses()).length)
    } catch {
      setSavedCount(0)
    }
  }, [])

  useEffect(() => { void refreshSaved() }, [refreshSaved])

  const sync = useCallback(async () => {
    if (syncInFlight) return null
    syncInFlight = true
    setSyncing(true)
    setError('')
    setDone(0)
    setPending(0)
    try {
      const result = await downloadAllAccessible(authedGet, {
        lang,
        wallet,
        authenticated: !!wallet,
        onStart: (info) => {
          setPending(info.pending)
          // El total son los pasos (guía + crucigrama), que es lo que ve el estudiante.
          setTotal(info.steps)
        },
        onProgress: (progress) => {
          setDone(progress.done)
          setTotal(progress.total)
          setLabel(progress.label)
        },
      })
      setLast(result)
      await refreshSaved()
      // Solo se marca como sincronizado si **nada** falló. Marcarlo con fallos dejaba
      // la biblioteca a medias y sin reintento durante 6 h (operador, 2026-09-25: en
      // el teléfono, al entrar a `/en` no se bajaba nada y solo se descargaba el
      // curso que se abría).
      if (result.failed.length === 0) {
        try { sessionStorage.setItem(SYNC_STAMP_KEY, String(Date.now())) } catch { /* almacenamiento bloqueado */ }
      }
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setSyncing(false)
      syncInFlight = false
    }
  }, [authedGet, lang, wallet, refreshSaved])

  return { syncing, done, total, pending, label, last, savedCount, error, ready, hold, sync }
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

/** Resumen legible de una sincronización (lo comparten el aviso y el control). */
function summarize(
  result: SyncResult,
  t: (key: string, ...args: string[]) => string,
): string {
  const parts: string[] = []
  if (result.downloaded.length) parts.push(`${result.downloaded.length} ${t('saved')}`)
  const current = result.skipped.filter((item) => item.reason === 'already-current').length
  if (current) parts.push(`${current} ${t('current')}`)
  const privacy = result.skipped.filter((item) => item.reason === 'privacy').length
  if (privacy) parts.push(`${privacy} ${t('privacy')}`)
  const notPurchased = result.skipped.filter((item) => item.reason === 'not-purchased').length
  if (notPurchased) parts.push(`${notPurchased} ${t('notPurchased')}`)
  if (result.failed.length) parts.push(`${result.failed.length} ${t('failed')}`)
  return parts.join(' · ') || t('nothingToDo')
}

/** Etiquetas del aviso de progreso y del control visible. */
function useOfflineStrings(lang: string) {
  return useMemo(() => createComponentT(lang, {
    en: {
      toastTitle: 'Preparing offline reading',
      toastProgress: 'Checking what is missing or out of date {{0}}/{{1}}',
      saved: 'saved',
      current: 'already up to date',
      nothingToDo: 'everything was already saved',
      privacy: 'not published (Christian content)',
      notPurchased: 'not purchased',
      failed: 'could not be saved',
    },
    es: {
      toastTitle: 'Preparando la lectura sin conexión',
      toastProgress: 'Verificando si falta descargar o actualizar alguna guía o prueba {{0}}/{{1}}',
      saved: 'guardados',
      current: 'ya estaban al día',
      nothingToDo: 'todo estaba ya guardado',
      privacy: 'sin publicar (contenido cristiano)',
      notPurchased: 'sin comprar',
      failed: 'no se pudieron guardar',
    },
  }), [lang])
}

/**
 * Sincronización automática. Se monta en el layout para que las guías queden
 * guardadas aunque el estudiante nunca abra la lista de cursos, y avisa con un
 * toast **solo si de verdad falta algo** (pedido del operador, 2026-09-23: el
 * aviso reemplaza al botón de descargar).
 */
export function OfflineLibrarySync({ lang }: { lang: string }) {
  const { sync, syncing, done, total, pending, last, error, ready, hold } = useOfflineLibrarySync(lang)
  const { toast } = useToast()
  const t = useOfflineStrings(lang)
  const attempted = useRef(false)
  const notice = useRef<ReturnType<typeof toast> | null>(null)

  useEffect(() => {
    if (attempted.current || syncing) return
    // Esperar a que la identidad esté resuelta (R-#227): antes de eso `authedGet`
    // viaja sin `walletAddress` y cada guía responde 401, así que la sincronización
    // completa fallaba en silencio al abrir la lista de cursos (operador,
    // 2026-09-25). Con `ready` en falso no se marca el intento: el efecto vuelve a
    // correr cuando la sesión se resuelve.
    if (!ready) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    // Respetar el ahorro de datos y las redes muy lentas: la sincronización baja todas
    // las guías accesibles (decenas de peticiones) y en un teléfono con plan limitado
    // conviene dejarla al control explícito. El freno **no** es silencioso: el control
    // visible de la lista de cursos lo explica y su enlace fuerza la verificación
    // (decisión del operador, 2026-09-25). Se lee el freno en el momento (y no sólo el
    // estado `hold`): en el primer paso del efecto el estado todavía es `null`.
    if (connectionHold()) return
    let lastRun = 0
    try { lastRun = Number(sessionStorage.getItem(SYNC_STAMP_KEY) || 0) } catch { /* idem */ }
    if (lastRun && Date.now() - lastRun < AUTO_SYNC_INTERVAL_MS) return
    attempted.current = true
    void sync()
  }, [hold, ready, sync, syncing])

  // Progreso: se abre el aviso cuando hay algo que traer y se actualiza con el
  // contador (`1/60` … `60/60`), y se cierra con el resumen al terminar.
  useEffect(() => {
    if (!syncing || pending <= 0) return
    if (!notice.current) {
      notice.current = toast({
        title: t('toastTitle'),
        description: t('toastProgress', String(done), String(total)),
      })
      return
    }
    notice.current.update({ id: notice.current.id, description: t('toastProgress', String(done), String(total)) })
  }, [syncing, pending, done, total, toast, t])

  useEffect(() => {
    if (syncing) return
    if (notice.current) {
      notice.current.update({
        id: notice.current.id,
        description: last ? summarize(last, t) : error,
        variant: error ? 'destructive' : 'default',
      })
      notice.current = null
      return
    }
    // Un fallo que no llegó a contar guías (por ejemplo, la consulta del catálogo)
    // no abría ningún aviso: el estudiante no sabía por qué no se descargaba nada.
    if (error) {
      toast({ title: t('toastTitle'), description: error, variant: 'destructive' })
    }
  }, [syncing, last, error, toast, t])

  return null
}

/** Control visible: cuántas páginas hay guardadas, el estado y el resumen. */
export function OfflineDownloadAll({ lang }: { lang: string }) {
  const { syncing, done, total, pending, last, savedCount, error, ready, hold, sync } = useOfflineLibrarySync(lang)
  const { toast } = useToast()
  const summaryT = useOfflineStrings(lang)
  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Courses on this device',
      ready: 'saved for reading offline',
      check: 'Check now',
      syncing: 'Checking',
      waiting: 'Waiting for a connection',
      privacy: 'not published (Christian content)',
      notPurchased: 'not purchased',
      error: 'Could not save the courses',
      paused: 'Paused: your connection is on data saver or is very slow. Tap "Check now" to download anyway.',
    },
    es: {
      title: 'Cursos en este dispositivo',
      ready: 'guardados para leer sin conexión',
      check: 'Verificar ahora',
      syncing: 'Verificando',
      waiting: 'Esperando conexión',
      privacy: 'sin publicar (contenido cristiano)',
      notPurchased: 'sin comprar',
      error: 'No se pudieron guardar los cursos',
      paused: 'En pausa: tu conexión está en ahorro de datos o es muy lenta. Toca "Verificar ahora" para descargar igualmente.',
    },
  }), [lang])

  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  // El efecto (cuántas guías o pruebas se guardaron o actualizaron) lo cuenta el
  // aviso; aquí solo queda el estado del dispositivo y el resultado.
  const onSync = useCallback(async () => {
    if (offline) {
      toast({ title: t('waiting') })
      return
    }
    // Con la identidad sin resolver la petición viaja anónima y el servidor responde
    // 401 por cada guía; mejor esperar (botón deshabilitado) que fallar en silencio.
    if (!ready) return
    const result = await sync()
    if (result) {
      toast({
        title: `${t('title')}: ${summarize(result, summaryT)}`,
      })
    } else {
      toast({ title: t('error'), variant: 'destructive' })
    }
  }, [offline, ready, sync, t, toast, summaryT])

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
          disabled={syncing || !ready}
          className="text-xs text-emerald-800 underline disabled:opacity-50"
        >
          {syncing && total > 0 ? `${t('syncing')} ${done}/${total}` : t('check')}
        </button>
      </div>

      {last && (
        <p className="mt-1 text-center text-xs text-gray-500">
          {summarize(last, summaryT)}
        </p>
      )}

      {!syncing && hold && (
        <p className="mt-1 text-center text-xs text-amber-700" data-testid="offline-connection-hold">
          {t('paused')}
        </p>
      )}

      {error && <p className="mt-1 text-center text-xs text-red-700">{t('error')}</p>}
    </div>
  )
}
