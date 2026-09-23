'use client'

import { useEffect } from 'react'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue'
import { createComponentT } from '@/lib/hooks/useTranslation'

/**
 * Aviso global del resultado de una respuesta resuelta sin conexión
 * (https://github.com/pasosdeJesus/learn.tg/issues/242).
 *
 * La cola se drena donde el hook esté montado, y antes eso solo pasaba en la
 * página del crucigrama: si el estudiante enviaba sin conexión y volvía a la lista
 * de cursos, al reconectar no veía nada (el operador lo reportó el 2026-09-23).
 * Este componente, montado en el layout, drena la cola en cualquier página y
 * avisa del resultado: correcta con la beca pagada, o las palabras con problema.
 */
export function OfflineQueueSync({ lang }: { lang: string }) {
  const { lastResult, clearLastResult, lastRejection, clearLastRejection } = useOfflineQueue()
  const { toast } = useToast()
  const t = createComponentT(lang, {
    en: {
      correct: 'Your saved answer was reviewed: correct!',
      incorrect: 'Your saved answer was reviewed: there are words to fix.',
      noReward: 'No new scholarship this time.',
      rejected: 'Your saved answer could not be accepted',
    },
    es: {
      correct: 'Se revisó tu respuesta guardada: ¡correcta!',
      incorrect: 'Se revisó tu respuesta guardada: hay palabras por corregir.',
      noReward: 'Esta vez no hubo beca nueva.',
      rejected: 'No se pudo aceptar tu respuesta guardada',
    },
  })

  useEffect(() => {
    if (!lastResult) return
    const body = lastResult.body || {}
    const mistakes = Array.isArray(body?.mistakesInCW) ? body.mistakesInCW.length : 0
    const usdt = Number(body?.scholarshipUsdt || 0)
    const slearn = Number(body?.scholarshipSlearn || 0)
    const reward = usdt > 0 || slearn > 0
      ? ` (${usdt} USDT + ${slearn} SLEARN)`
      : ` ${t('noReward')}`
    toast({
      title: mistakes === 0 ? `${t('correct')}${reward}` : t('incorrect'),
      description: mistakes > 0 ? `#${body.mistakesInCW.join(', #')}` : undefined,
    })
    clearLastResult()
  }, [lastResult, clearLastResult, t, toast])

  useEffect(() => {
    if (!lastRejection) return
    toast({
      title: t('rejected'),
      description: lastRejection.message || `HTTP ${lastRejection.status}`,
      variant: 'destructive',
    })
    clearLastRejection()
  }, [lastRejection, clearLastRejection, t, toast])

  return null
}
