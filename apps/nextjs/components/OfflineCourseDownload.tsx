'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { downloadCourse, revalidateCourse } from '@/lib/offline-course-download'

/**
 * Botón "descargar el curso para leerlo sin conexión"
 * (https://github.com/pasosdeJesus/learn.tg/issues/256 §3.2).
 *
 * - Solo se ofrece cuando la billetera puede leer el curso (gratuito, o comprado
 *   por esta billetera).
 * - Un curso con `contenido_cristiano` solo se descarga con el interruptor de
 *   R-#259 encendido; si está apagado no se ofrece y la copia local se borra
 *   (§3.6b: el teléfono no debe revelar la afiliación por sí solo).
 * - Muestra el espacio que ocupa, avisa cuando el dispositivo va corto de espacio
 *   y permite eliminar la copia.
 * - Al abrir con conexión, revalida si la copia tiene más de 24 h y avisa si el
 *   curso cambió.
 */

interface OfflineCourseDownloadProps {
  lang: string
  courseId: number
  prefix: string
  titulo: string | null
  contenidoCristiano: boolean
  isPremium: boolean
  /** Sufijos de ruta de las guías publicadas, en orden. */
  guides: string[]
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
  contenidoCristiano,
  isPremium,
  guides,
  canRead,
}: OfflineCourseDownloadProps) {
  const { authedGet, ready, wallet } = useAuthedApi()
  const [record, setRecord] = useState<DownloadedCourse | null>(null)
  const [christianVisible, setChristianVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [message, setMessage] = useState('')
  const [lowSpace, setLowSpace] = useState(false)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      download: 'Download for offline',
      downloading: 'Downloading',
      remove: 'Remove download',
      removeConfirm: 'Remove the offline copy of this course? It will be downloaded again the next time you ask.',
      courseFiles: 'Saved on this device',
      offlineReady: 'You can read this course without a connection',
      updated: 'This course was updated: the saved copy was refreshed',
      failed: 'The course could not be downloaded. Check your connection and try again.',
      lowSpace: 'Your device is running out of space; the download may fail.',
      canceled: 'Download removed',
    },
    es: {
      download: 'Descargar para leer sin conexión',
      downloading: 'Descargando',
      remove: 'Eliminar la descarga',
      removeConfirm: '¿Eliminar la copia sin conexión de este curso? Se volverá a descargar la próxima vez que lo pidas.',
      courseFiles: 'Guardado en este dispositivo',
      offlineReady: 'Puedes leer este curso sin conexión',
      updated: 'Este curso cambió: la copia guardada se actualizó',
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
    contenidoCristiano,
    isPremium,
    guides,
  }), [courseId, lang, prefix, titulo, contenidoCristiano, isPremium, guides])

  const refreshRecord = useCallback(async () => {
    setRecord(await getDownloadedCourse(key))
  }, [key])

  // El interruptor de privacidad solo existe para quien tiene sesión; para un
  // visitante anónimo un curso cristiano no se descarga (§3.6b).
  useEffect(() => {
    if (!ready || !contenidoCristiano) return
    if (!wallet) {
      setChristianVisible(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedGet<{ publicCourses: boolean; publicChristianCourses: boolean }>('/api/settings')
        if (cancelled) return
        setChristianVisible(
          res.data?.publicCourses !== false && res.data?.publicChristianCourses === true,
        )
      } catch {
        if (!cancelled) setChristianVisible(false)
      }
    })()
    return () => { cancelled = true }
  }, [ready, wallet, contenidoCristiano, authedGet])

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

  const download = useCallback(async () => {
    setBusy(true)
    setMessage('')
    setDone(0)
    setTotal(guides.length * 2)
    try {
      await downloadCourse(descriptor, {
        get: authedGet,
        wallet,
        onProgress: (progress) => {
          setDone(progress.done)
          setTotal(progress.total)
        },
      })
      await refreshRecord()
    } catch {
      setMessage(t('failed'))
    } finally {
      setBusy(false)
    }
  }, [descriptor, authedGet, wallet, guides.length, refreshRecord, t])

  const remove = useCallback(async () => {
    await deleteDownloadedCourse(key)
    await refreshRecord()
    setMessage(t('canceled'))
  }, [key, refreshRecord, t])

  // Revalidación (R-#256 §3.6): con conexión y una copia de más de 24 h, se
  // refresca en segundo plano y se avisa si el contenido cambió.
  useEffect(() => {
    if (!ready || !record || busy) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (!isStale(record)) return
    let cancelled = false
    ;(async () => {
      const result = await revalidateCourse(descriptor, { get: authedGet, wallet })
      if (cancelled || !result.updated) return
      setMessage(t('updated'))
      await refreshRecord()
    })()
    return () => { cancelled = true }
  }, [ready, record, busy, descriptor, authedGet, wallet, refreshRecord, t])

  if (!canRead) return null
  // Sin curso resuelto (ni prefijo) no hay nada que descargar.
  if (!prefix || !courseId || guides.length === 0) return null
  if (contenidoCristiano && !christianVisible) return null

  const visible = record && belongsToWallet(record, wallet)

  return (
    <div className="px-6 py-4 rounded-xl bg-white text-gray-800 shadow" data-testid="offline-course-download">
      {!visible && (
        <button
          type="button"
          onClick={download}
          disabled={busy || guides.length === 0}
          className="w-full rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? `${t('downloading')} (${done}/${total})` : t('download')}
        </button>
      )}

      {visible && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-700">{t('offlineReady')}</p>
          <p className="text-xs text-gray-500">
            {t('courseFiles')}: <span className="font-semibold">{formatBytes(record.bytes)}</span>
            {' · '}
            {new Date(record.downloadedAt).toLocaleDateString(lang === 'es' ? 'es' : 'en')}
          </p>
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
