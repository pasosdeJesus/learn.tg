'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@pasosdejesus/m/shadcn-components/ui/dialog'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Slot {
  start: string
  end: string
}

interface Props {
  lang?: string
  interviewDate: string | null
  timezone?: string
  onBooked?: () => void
  onCancel?: () => void
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const DEFAULT_TIMEZONE = 'Africa/Freetown'

function getTimezoneLabel(tz: string): string {
  const now = new Date()
  const utc = now.toLocaleString('en', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false })
  const local = now.toLocaleString('en', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
  const [uh, um] = utc.split(':').map(Number)
  const [lh, lm] = local.split(':').map(Number)
  let offsetMin = (lh * 60 + lm) - (uh * 60 + um)
  if (offsetMin > 720) offsetMin -= 1440
  if (offsetMin < -720) offsetMin += 1440
  const sign = offsetMin >= 0 ? '+' : '-'
  const a = Math.abs(offsetMin)
  const offset = `GMT${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
  return `${tz} (${offset})`
}

function formatInZone(d: Date, lang: string, tz: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en', {
    timeZone: tz,
    ...options,
  }).format(d)
}

function formatLocal(d: Date, lang: string, tz: string, withTime?: boolean): string {
  const datePart = formatInZone(d, lang, tz, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  if (!withTime) return datePart
  const timePart = formatInZone(d, lang, tz, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return `${datePart} ${lang === 'es' ? 'a las' : 'at'} ${timePart} (${getTimezoneLabel(tz)})`
}

export function VerificationScheduler({ lang = 'en', interviewDate, timezone, onBooked, onCancel }: Props) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isBooking, setIsBooking] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const { toast } = useToast()
  const { data: session } = useSession()
  const { address } = useAuthAddress()

  const months = lang === 'es' ? MONTHS_ES : MONTHS_EN
  const dayHeaders = lang === 'es' ? DAYS_ES : DAYS_EN
  const tz = timezone || DEFAULT_TIMEZONE
  const tzLabel = getTimezoneLabel(tz)

  const t = createComponentT(lang, {
    en: {
      title: 'Schedule Verification Interview',
      description: `Select a date and time. All times are in ${tzLabel}.`,
      why: 'To verify your identity and unlock rewards, a brief 30-minute video call is required. It\'s a friendly conversation — no preparation needed.',
      loadingSlots: 'Loading available slots...',
      noSlotsDate: 'No slots available for this date.',
      book: 'Book Interview',
      booking: 'Booking...',
      success: 'Interview scheduled successfully!',
      cancelled: 'Interview cancelled. You can schedule a new one.',
      error: 'Failed to schedule interview',
      scheduled: 'Interview scheduled for',
      missed: 'Interview was scheduled for {{0}} but was not completed',
      completed: 'Interview completed on',
      reschedule: 'Reschedule',
      cancel: 'Cancel Interview',
      cancelling: 'Cancelling...',
      confirmCancelTitle: 'Cancel Interview?',
      confirmCancelDesc: 'This will cancel your scheduled interview. You can book a new one later. Are you sure?',
      confirmCancelYes: 'Yes, Cancel',
      confirmCancelNo: 'Keep It',
      openCalendar: 'Schedule Interview',
      close: 'Close',
    },
    es: {
      title: 'Agendar Entrevista de Verificación',
      description: `Selecciona fecha y hora. Todos los horarios están en ${tzLabel}.`,
      why: 'Para verificar tu identidad y desbloquear recompensas, necesitamos una breve videollamada de 30 minutos. Es una conversación amigable — no necesitas preparar nada.',
      loadingSlots: 'Cargando horarios disponibles...',
      noSlotsDate: 'No hay horarios para esta fecha.',
      book: 'Agendar Entrevista',
      booking: 'Agendando...',
      success: '¡Entrevista agendada exitosamente!',
      cancelled: 'Entrevista cancelada. Puedes agendar una nueva.',
      error: 'Error al agendar entrevista',
      scheduled: 'Entrevista agendada para el',
      missed: 'La entrevista estaba agendada para el {{0}} pero no se completó',
      completed: 'Entrevista realizada el',
      reschedule: 'Reagendar',
      cancel: 'Cancelar Entrevista',
      cancelling: 'Cancelando...',
      confirmCancelTitle: '¿Cancelar Entrevista?',
      confirmCancelDesc: 'Esto cancelará tu entrevista agendada. Puedes agendar una nueva después. ¿Estás seguro?',
      confirmCancelYes: 'Sí, Cancelar',
      confirmCancelNo: 'Conservarla',
      openCalendar: 'Agendar Entrevista',
      close: 'Cerrar',
    },
  })

  const interviewDateObj = interviewDate ? new Date(interviewDate) : null
  const isPast = interviewDateObj ? interviewDateObj < new Date() : false
  const hasInterview = !!interviewDate

  useEffect(() => {
    if (dialogOpen && session?.address && address) {
      fetchSlots()
    }
    if (!dialogOpen) {
      setSelectedDate(null)
      setSelectedSlot(null)
    }
  }, [dialogOpen, session?.address, address])

  // Auto-cancel missed interviews silently (keep message until reschedule)
  useEffect(() => {
    if (hasInterview && isPast && address) {
      const token = localStorage.getItem('learn.tg.authToken')
      fetch('/api/verification/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, token }),
      }).catch(() => {})
    }
  }, [hasInterview, isPast, address])

  const fetchSlots = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/verification/availability?days=14&duration=30')
      const data = await res.json()
      setSlots(data.slots || [])
    } catch {
      toast({ title: t('error'), variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBook = async () => {
    if (!selectedSlot || !address) return

    setIsBooking(true)
    try {
      const token = localStorage.getItem('learn.tg.authToken')
      const res = await fetch('/api/verification/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          token,
          start: selectedSlot.start,
          end: selectedSlot.end,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('error'))
      toast({ title: t('success') })
      setSelectedSlot(null)
      setSelectedDate(null)
      setDialogOpen(false)
      onBooked?.()
    } catch {
      toast({ title: t('error'), variant: 'destructive' })
    } finally {
      setIsBooking(false)
    }
  }

  const handleCancel = async () => {
    if (!address) return
    setIsCancelling(true)
    try {
      const token = localStorage.getItem('learn.tg.authToken')
      const res = await fetch('/api/verification/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, token }),
      })
      if (!res.ok) throw new Error()
      toast({ title: t('cancelled') })
      setConfirmCancelOpen(false)
      onCancel?.()
    } catch {
      toast({ title: t('error'), variant: 'destructive' })
    } finally {
      setIsCancelling(false)
    }
  }

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    return days
  }, [viewDate])

  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {}
    for (const s of slots) {
      const dateKey = s.start.slice(0, 10)
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(s)
    }
    return map
  }, [slots])

  const selectedDateKey = selectedDate
    ? selectedDate.toISOString().slice(0, 10)
    : null
  const daySlots = selectedDateKey ? (slotsByDate[selectedDateKey] || []) : []

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))

  const today = new Date()
  const isCurrentMonth = viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear()
  const isNextMonth = viewDate.getMonth() === (today.getMonth() + 1) % 12 && viewDate.getFullYear() === today.getFullYear() + (today.getMonth() === 11 ? 1 : 0)

  const todayKey = today.toISOString().slice(0, 10)

  const formatTime = (iso: string) =>
    formatInZone(new Date(iso), lang, tz, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

  return (
    <div className="space-y-3">
      {hasInterview && interviewDateObj ? (
        <div className={`border rounded-lg p-4 space-y-2 ${isPast ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
          <p className={`text-sm ${isPast ? 'text-amber-800' : 'text-blue-800'}`}>
            {isPast
              ? t('missed', formatLocal(interviewDateObj, lang, tz, true))
              : `${t('scheduled')} ${formatLocal(interviewDateObj, lang, tz, true)}`
            }
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              {t('reschedule')}
            </Button>
            {!isPast && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmCancelOpen(true)}
              className="text-red-600 hover:text-red-700"
            >
              {t('cancel')}
            </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t('why')}</p>
          <Button variant="default" onClick={() => setDialogOpen(true)}>
            {t('openCalendar')}
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <p className="text-sm text-gray-600">{t('description')}</p>
            <p className="text-sm text-gray-500 mt-2">{t('why')}</p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className={`p-1 rounded ${isCurrentMonth ? 'text-gray-300 cursor-default' : 'hover:bg-gray-100'}`} disabled={isCurrentMonth}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-semibold text-sm">
                {months[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <button onClick={nextMonth} className={`p-1 rounded ${isNextMonth ? 'text-gray-300 cursor-default' : 'hover:bg-gray-100'}`} disabled={isNextMonth}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 font-medium">
              {dayHeaders.map(d => <div key={d}>{d}</div>)}
            </div>

            {/* Calendar grid */}
            {isLoading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="h-9 w-9 rounded-full bg-gray-100 animate-pulse mx-auto" />
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />

                const dateKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const hasSlots = !!slotsByDate[dateKey]
                const isPastDate = dateKey < todayKey
                const isSel = dateKey === selectedDateKey

                return (
                  <button
                    key={dateKey}
                    disabled={!hasSlots || isPastDate}
                    onClick={() => {
                      const d = new Date(Date.UTC(viewDate.getFullYear(), viewDate.getMonth(), day))
                      setSelectedDate(d)
                      setSelectedSlot(null)
                    }}
                    className={`
                      h-9 w-9 rounded-full text-xs font-medium flex items-center justify-center
                      ${!hasSlots || isPastDate ? 'text-gray-300 cursor-default' : ''}
                      ${hasSlots && !isPastDate && !isSel ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}
                      ${isSel ? 'bg-blue-600 text-white' : ''}
                    `}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            )}

            {/* Time slots for selected date */}
            {selectedDate && !isLoading && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">
                  {formatLocal(selectedDate, lang, tz)}
                </p>
                {isLoading ? (
                  <p className="text-gray-500 text-sm">{t('loadingSlots')}</p>
                ) : daySlots.length === 0 ? (
                  <p className="text-gray-500 text-sm">{t('noSlotsDate')}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {daySlots.map((slot, i) => (
                      <Button
                        key={i}
                        variant={selectedSlot?.start === slot.start ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {formatTime(slot.start)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Book button */}
            {selectedSlot && (
              <Button onClick={handleBook} disabled={isBooking} className="w-full">
                {isBooking ? t('booking') : `${t('book')} — ${formatTime(selectedSlot.start)}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('confirmCancelTitle')}</DialogTitle>
            <p className="text-sm text-gray-600">{t('confirmCancelDesc')}</p>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmCancelOpen(false)} disabled={isCancelling}>
              {t('confirmCancelNo')}
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? t('cancelling') : t('confirmCancelYes')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
