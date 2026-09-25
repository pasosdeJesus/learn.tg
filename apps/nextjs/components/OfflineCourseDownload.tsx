'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'
import {
  belongsToWallet,
  deleteDownloadedCourse,
  getDownloadedCourse,
  isStale,
  courseKey,
  type DownloadedCourse,
} from '@/lib/offline-course-db'
import { revalidateCourse } from '@/lib/offline-course-download'

/**
 * Guarda el curso para leerlo sin conexión, **sin botón**: al abrir la página con
 * conexión se sincroniza sola y el efecto se cuenta con un aviso
 * (https://github.com/pasosdeJesus/learn.tg/issues/256 §3.2; pedido del operador,
 * 2026-09-23: iPhone Safari, el botón de descargar no bastaba).
 *
 * - Solo se ofrece cuando la billetera puede leer el curso (gratuito, o comprado
 *   por esta billetera).
 * - Un curso con `contenido_sensible` solo se descarga con el interruptor de
 *   R-#259 encendido; si está apagado no se ofrece y la copia local se borra
 *   (§3.6b: el teléfono no debe revelar la afiliación por sí solo).
 * - Muestra el espacio que ocupa, avisa cuando el dispositivo va corto de espacio
 *   y permite eliminar la copia.
 * - Al abrir con conexión, revalida si la copia tiene más de una semana y avisa si el
 *   curso cambió.
 */

interface OfflineCourseDownloadProps {
  lang: string
  courseId: number
  prefix: string
  titulo: string | null
  contenidoSensible: boolean
  isPremium: boolean
  /** Sufijos de ruta de las guías publicadas, en orden. */
  guides: string[]
  /** R-#256 §3.10: presentación del curso, para que la copia sin conexión tenga el
   * subtítulo y el resumen. */
  subtitulo?: string | null
  resumenMd?: string | null
  /** R-#256 §3.10: avance de cada guía al descargar, por sufijo. */
  guideStatus?: Record<string, {
    completed?: boolean
    receivedScholarship?: boolean
    receivedSlearnScholarship?: boolean
  }>
  /** El curso (y su contenido) es legible por quien está navegando. */
  canRead: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function OfflineCourseDownload({
  lang,
  courseId,
  prefix,
  titulo,
  contenidoSensible,
  isPremium,
  guides,
  subtitulo,
  resumenMd,
  guideStatus,
  canRead,
}: OfflineCourseDownloadProps) {
  const { authedGet, ready, wallet } = useAuthedApi()
  const { toast } = useToast()
  const [record, setRecord] = useState<DownloadedCourse | null>(null)
  // Hasta leer el store no se sabe si hay copia: sin esto la sincronización
  // dispararía con `record === null` y volvería a bajar una copia al día.
  const [recordLoaded, setRecordLoaded] = useState(false)
  const [sensitiveVisible, setSensitiveVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [message, setMessage] = useState('')
  const [lowSpace, setLowSpace] = useState(false)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      remove: 'Remove download',
      removeConfirm: 'Remove the offline copy of this course? It will be downloaded again the next time you ask.',
      courseFiles: 'Saved on this device',
      offlineReady: 'You can read this course without a connection',
      preparing: 'Preparing this course for offline reading',
      toastTitle: 'Preparing this course for offline reading',
      toastProgress: 'Saving guides and crosswords {{0}}/{{1}}',
      toastSaved: 'Course saved for offline reading',
      toastUpdated: 'The course changed: the saved copy was refreshed',
      failed: 'The course could not be downloaded. Check your connection and try again.',
      lowSpace: 'Your device is running out of space; the download may fail.',
      canceled: 'Download removed',
    },
    es: {
            remove: 'Eliminar la descarga',
      removeConfirm: '¿Eliminar la copia sin conexión de este curso? Se volverá a descargar la próxima vez que lo pidas.',
      courseFiles: 'Guardado en este dispositivo',
      offlineReady: 'Puedes leer este curso sin conexión',
      preparing: 'Preparando este curso para leerlo sin conexión',
      toastTitle: 'Preparando este curso para leerlo sin conexión',
      toastProgress: 'Guardando guías y crucigramas {{0}}/{{1}}',
      toastSaved: 'Curso guardado para leerlo sin conexión',
      toastUpdated: 'Este curso cambió: la copia guardada se actualizó',
      failed: 'No se pudo descargar el curso. Revisa tu conexión e inténtalo de nuevo.',
      lowSpace: 'A tu dispositivo le queda poco espacio; la descarga podría fallar.',
      canceled: 'Descarga eliminada',
    },
  }), [lang])

  const key = courseKey(lang, prefix)

  const descriptor = useMemo(() => ({
    courseId,
    lang,
    prefix,
    titulo,
    contenidoSensible,
    isPremium,
    guides,
    // R-#256 §3.10: la presentación y el avance al descargar quedan en el registro.
    subtitulo: subtitulo ?? null,
    resumenMd: resumenMd ?? null,
    guideStatus,
  }), [courseId, lang, prefix, titulo, contenidoSensible, isPremium, guides, subtitulo, resumenMd, guideStatus])

  const refreshRecord = useCallback(async () => {
    setRecord(await getDownloadedCourse(key))
    setRecordLoaded(true)
  }, [key])

  // El interruptor de privacidad solo existe para quien tiene sesión; para un
  // visitante anónimo un curso sensible no se descarga (§3.6b).
  useEffect(() => {
    if (!ready || !contenidoSensible) return
    if (!wallet) {
      setSensitiveVisible(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedGet<{ publicCourses: boolean; publicSensitiveCourses: boolean }>('/api/settings')
        if (cancelled) return
        setSensitiveVisible(
          res.data?.publicCourses !== false && res.data?.publicSensitiveCourses === true,
        )
      } catch {
        if (!cancelled) setSensitiveVisible(false)
      }
    })()
    return () => { cancelled = true }
  }, [ready, wallet, contenidoSensible, authedGet])

  useEffect(() => {
    void refreshRecord()
  }, [refreshRecord])

  // Aviso de espacio (R-#256 §3.2): una descarga grande en un teléfono corto de
  // espacio falla a mitad de camino.
  useEffect(() => {
    if (!record) return
    const estimate = (navigator as any)?.storage?.estimate
    if (typeof estimate !== 'function') return
    void estimate.call((navigator as any).storage)
      .then((info: any) => {
        const quota = Number(info?.quota || 0)
        const usage = Number(info?.usage || 0)
        if (quota > 0 && usage / quota > 0.9) setLowSpace(true)
      })
      .catch(() => { /* el navegador no lo soporta */ })
  }, [record])

  const announce = useRef<ReturnType<typeof toast> | null>(null)
  const attemptedSync = useRef(false)

  /**
   * Trae el curso (o refresca la copia caducada) contando el avance en un aviso.
   * Es automático: el estudiante no pide la descarga (pedido del operador, 2026-09-23).
   */
  const runSync = useCallback(async () => {
    setBusy(true)
    setMessage('')
    setDone(0)
    const totalSteps = guides.length * 2
    setTotal(totalSteps)
    announce.current = toast({
      title: t('toastTitle'),
      description: t('toastProgress', '0', String(totalSteps)),
    })
    try {
      const previous = await getDownloadedCourse(key)
      const result = await revalidateCourse(descriptor, {
        get: authedGet,
        wallet,
        onProgress: (progress) => {
          setDone(progress.done)
          setTotal(progress.total)
          announce.current?.update({ id: announce.current.id, description: t('toastProgress', String(progress.done), String(progress.total)) })
        },
      })
      if (result.course) {
        announce.current?.update({
          id: announce.current.id,
          title: previous && result.updated ? t('toastUpdated') : t('toastSaved'),
          description: '',
        })
      } else {
        setMessage(t('failed'))
        announce.current?.update({ id: announce.current.id, title: t('failed'), variant: 'destructive' })
      }
      await refreshRecord()
    } catch {
      setMessage(t('failed'))
      announce.current?.update({ id: announce.current.id, title: t('failed'), variant: 'destructive' })
    } finally {
      announce.current = null
      setBusy(false)
    }
  }, [descriptor, authedGet, wallet, guides.length, key, refreshRecord, t, toast])

  const remove = useCallback(async () => {
    await deleteDownloadedCourse(key)
    await refreshRecord()
    setMessage(t('canceled'))
  }, [key, refreshRecord, t])

  // Sincronización automática (R-#256 §3.6): con conexión, si no hay copia o la
  // copia caducó, se guarda sola y se avisa si el contenido cambió. Un solo intento
  // por montaje: si el servidor falla, no se reintenta en bucle.
  useEffect(() => {
    if (!ready || busy || !recordLoaded || attemptedSync.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    // Una copia de otra billetera (o de pago sin derecho) no cuenta como propia:
    // se vuelve a guardar para esta.
    if (record && belongsToWallet(record, wallet) && !isStale(record)) return
    if (!canRead || !prefix || !courseId || guides.length === 0) return
    if (contenidoSensible && !sensitiveVisible) return
    attemptedSync.current = true
    void runSync()
  }, [ready, busy, recordLoaded, record, canRead, prefix, courseId, guides.length, contenidoSensible, sensitiveVisible, runSync])

  if (!canRead) return null
  // Sin curso resuelto (ni prefijo) no hay nada que descargar.
  if (!prefix || !courseId || guides.length === 0) return null
  if (contenidoSensible && !sensitiveVisible) return null

  const visible = record && belongsToWallet(record, wallet)
  // R-#256 §3.10: la copia guarda el avance del momento de la descarga; se muestra con
  // su fecha para que el estudiante sepa que es una foto, no el estado actual.
  const savedGuides = record?.guides ?? []
  const completedGuides = savedGuides.filter((guide) => guide.completed).length
  const savedOn = record
    ? new Date(record.downloadedAt).toLocaleDateString(lang === 'es' ? 'es' : 'en')
    : ''

  return (
    <div className="px-6 py-4 rounded-xl bg-white text-gray-800 shadow" data-testid="offline-course-download">
      {!visible && (
        <p className="text-sm text-gray-700">
          {busy ? `${t('toastTitle')} ${done}/${total}` : t('preparing')}
        </p>
      )}

      {visible && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-700">{t('offlineReady')}</p>
          <p className="text-xs text-gray-500">
            {t('courseFiles')}: <span className="font-semibold">{formatBytes(record.bytes)}</span>
            {' · '}
            {savedOn}
          </p>
          {savedGuides.length > 0 && (
            <p className="text-xs text-gray-500" data-testid="offline-progress">
              {lang === 'es' ? 'Avance al ' : 'Progress as of '}
              {savedOn}
              {': '}
              <span className="font-semibold">
                {completedGuides}/{savedGuides.length}
              </span>
              {lang === 'es' ? ' guías completadas' : ' guides completed'}
            </p>
          )}
          <button
            type="button"
            onClick={remove}
            className="self-start text-xs text-red-700 underline"
          >
            {t('remove')}
          </button>
        </div>
      )}

      {lowSpace && <p className="mt-2 text-xs text-amber-700">{t('lowSpace')}</p>}
      {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
    </div>
  )
}
