'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface Slot {
  start: string
  end: string
}

interface Props {
  lang?: string
  onBooked?: () => void
}

export function VerificationScheduler({ lang = 'en', onBooked }: Props) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isBooking, setIsBooking] = useState(false)
  const { toast } = useToast()
  const { data: session } = useSession()
  const { address } = useAuthAddress()

  const t = createComponentT(lang, {
    en: {
      title: 'Schedule Verification Interview',
      description: 'Select a time slot for your verification interview. The interview takes about 20-30 minutes.',
      loadingSlots: 'Loading available slots...',
      noSlots: 'No slots available in the next 14 days. Please check back later.',
      book: 'Book Interview',
      booking: 'Booking...',
      success: 'Interview scheduled successfully!',
      error: 'Failed to schedule interview',
      unauthorized: 'Please connect your wallet first',
    },
    es: {
      title: 'Agendar Entrevista de Verificación',
      description: 'Selecciona un horario para tu entrevista de verificación. La entrevista dura entre 20 y 30 minutos.',
      loadingSlots: 'Cargando horarios disponibles...',
      noSlots: 'No hay horarios disponibles en los próximos 14 días. Por favor revisa más tarde.',
      book: 'Agendar Entrevista',
      booking: 'Agendando...',
      success: '¡Entrevista agendada exitosamente!',
      error: 'Error al agendar entrevista',
      unauthorized: 'Por favor conecta tu billetera primero',
    },
  })

  useEffect(() => {
    if (session?.address && address) {
      fetchSlots()
    }
  }, [session?.address, address])

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
      onBooked?.()
      fetchSlots()
    } catch {
      toast({ title: t('error'), variant: 'destructive' })
    } finally {
      setIsBooking(false)
    }
  }

  if (isLoading) {
    return <p className="text-gray-500 text-sm">{t('loadingSlots')}</p>
  }

  if (slots.length === 0) {
    return <p className="text-gray-500 text-sm">{t('noSlots')}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('description')}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {slots.map((slot, i) => (
          <Button
            key={i}
            variant={selectedSlot?.start === slot.start ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setSelectedSlot(slot)}
          >
            {new Date(slot.start).toLocaleString(lang === 'es' ? 'es' : 'en', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Button>
        ))}
      </div>
      {selectedSlot && (
        <Button onClick={handleBook} disabled={isBooking} className="w-full">
          {isBooking ? t('booking') : t('book')}
        </Button>
      )}
    </div>
  )
}
