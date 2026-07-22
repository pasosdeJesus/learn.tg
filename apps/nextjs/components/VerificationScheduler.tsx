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
  onBooked?: () => void
  onCancel?: () => void
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function getGmtOffset(): string {
  const o = -new Date().getTimezoneOffset()
  const s = o >= 0 ? '+' : '-'
  const a = Math.abs(o)
  return `GMT${s}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
}

function formatLocal(d: Date, lang: string, withTime?: boolean): string {
  const datePart = d.toLocaleDateString(lang === 'es' ? 'es' : 'en', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  if (!withTime) return datePart
  const timePart = d.toLocaleTimeString(lang === 'es' ? 'es' : 'en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return `${datePart} ${lang === 'es' ? 'a las' : 'at'} ${timePart} (${getGmtOffset()})`
}

export function VerificationScheduler({ lang = 'en', interviewDate, onBooked, onCancel }: Props) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isBooking, setIsBooking] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const { toast } = useToast()
  const { data: session } = useSession()
  const { address } = useAuthAddress()

  const months = lang === 'es' ? MONTHS_ES : MONTHS_EN
  const dayHeaders = lang === 'es' ? DAYS_ES : DAYS_EN

  const t = createComponentT(lang, {
    en: {
      title: 'Schedule Verification Interview',
      description: 'Select a date and time. All times are in your local timezone.',
      loadingSlots: 'Loading available slots...',
      noSlotsDate: 'No slots available for this date.',
      book: 'Book Interview',
      booking: 'Booking...',
      success: 'Interview scheduled successfully!',
      cancelled: 'Interview cancelled. You can schedule a new one.',
      error: 'Failed to schedule interview',
      scheduled: 'Interview scheduled for',
      missed: 'Interview was scheduled for {0} but was not completed',
      completed: 'Interview completed on',
      reschedule: 'Reschedule',
      cancel: 'Cancel Interview',
      cancelling: 'Cancelling...',
      openCalendar: 'Schedule Interview',
      close: 'Close',
    },
    es: {
      title: 'Agendar Entrevista de Verificación',
      description: 'Selecciona fecha y hora. Todos los horarios están en tu zona horaria local.',
      loadingSlots: 'Cargando horarios disponibles...',
      noSlotsDate: 'No hay horarios para esta fecha.',
      book: 'Agendar Entrevista',
      booking: 'Agendando...',
      success: '¡Entrevista agendada exitosamente!',
      cancelled: 'Entrevista cancelada. Puedes agendar una nueva.',
      error: 'Error al agendar entrevista',
      scheduled: 'Entrevista agendada para el',
      missed: 'La entrevista estaba agendada para el {0} pero no se completó',
      completed: 'Entrevista realizada el',
      reschedule: 'Reagendar',
      cancel: 'Cancelar Entrevista',
      cancelling: 'Cancelando...',
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
  }, [dialogOpen, session?.address, address])

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
  const todayKey = today.toISOString().slice(0, 10)

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(lang === 'es' ? 'es' : 'en', {
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
              ? t('missed', formatLocal(interviewDateObj, lang, true))
              : `${t('scheduled')} ${formatLocal(interviewDateObj, lang, true)}`
            }
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              {t('reschedule')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isCancelling}
              className="text-red-600 hover:text-red-700"
            >
              {isCancelling ? t('cancelling') : t('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          {t('openCalendar')}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <p className="text-sm text-gray-600">{t('description')}</p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-semibold text-sm">
                {months[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 font-medium">
              {dayHeaders.map(d => <div key={d}>{d}</div>)}
            </div>

            {/* Calendar grid */}
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

            {/* Time slots for selected date */}
            {selectedDate && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">
                  {formatLocal(selectedDate, lang)}
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
    </div>
  )
}
