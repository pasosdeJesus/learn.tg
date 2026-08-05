'use client'

import { useState, useEffect } from 'react'
import { useSession, getCsrfToken } from 'next-auth/react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pasosdejesus/m/shadcn-components/ui/dialog'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { Input } from '@pasosdejesus/m/shadcn-components/ui/input'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (churchId: number) => void
  countryId: number | null
  cityName: string
  churchName: string
  churchRelationship: string | null
  lang?: string
}

export function NewChurchDialog({
  open,
  onOpenChange,
  onSuccess,
  countryId,
  cityName,
  churchName,
  churchRelationship,
  lang = 'en',
}: Props) {
  const [name, setName] = useState(churchName)
  const [churchAddress, setChurchAddress] = useState('')
  const [pastorName, setPastorName] = useState('')
  const [pastorWhatsapp, setPastorWhatsapp] = useState('')
  const [indicativo, setIndicativo] = useState('+232')
  const [registration, setRegistration] = useState('')
  const [registrationPhoto, setRegistrationPhoto] = useState<File | null>(null)
  const [zionQ1, setZionQ1] = useState('')
  const [zionQ2, setZionQ2] = useState('')
  const [zionQ3, setZionQ3] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { data: session } = useSession()
  const { address } = useAuthAddress()

  const t = createComponentT(lang, {
    en: {
      title: 'Register New Church',
      churchName: 'Church name',
      churchAddress: 'Address',
      pastorName: 'Pastor name',
      pastorWhatsapp: 'Pastor WhatsApp',
      registration: 'Registration number',
      registrationPhoto: 'Registration document',
      required: 'required for pastors',
      cancel: 'Cancel',
      register: 'Register Church',
      success: 'Church registered successfully',
      error: 'Failed to register church',
      noAuth: 'You must be connected to register a church',
      fillRequired: 'Please fill all required fields',
      pastorNote: 'Please inform your pastor that to confirm your membership we may contact him via WhatsApp. We encourage you to invite him to learn.tg.',
      zionTitle: 'Theological Position (optional)',
      zionQ1: 'Do you believe God has a plan of salvation for ethnic Israel that operates through a separate covenant or dispensation, independent of faith in Jesus Christ (e.g., restoration of Levitical sacrifices in the millennium)?',
      zionQ2: 'Do you believe the true Israel of God is exclusively the remnant of Jews and Gentiles who believe in Jesus, and that the territorial promises are ultimately fulfilled in the new creation?',
      zionQ3: 'Considering the ICJ has found a "plausible risk of genocide" in Gaza, the ICC has issued arrest warrants for war crimes, and the UN Independent Commission of Inquiry has concluded that Israel has committed acts of genocide in Gaza —including deliberate targeting of children—, do you believe Christians should unconditionally support the Modern State of Israel?',
    },
    es: {
      title: 'Registrar Nueva Iglesia',
      churchName: 'Nombre de la iglesia',
      churchAddress: 'Dirección',
      pastorName: 'Nombre del pastor',
      pastorWhatsapp: 'WhatsApp del pastor',
      registration: 'Número de registro',
      registrationPhoto: 'Documento de registro',
      required: 'requerido para pastores',
      cancel: 'Cancelar',
      register: 'Registrar Iglesia',
      success: 'Iglesia registrada exitosamente',
      error: 'Error al registrar iglesia',
      noAuth: 'Debes estar conectado para registrar una iglesia',
      fillRequired: 'Por favor llena todos los campos requeridos',
      pastorNote: 'Por favor infórmale a tu pastor que para confirmar tu membresía posiblemente nos comunicaremos con él por WhatsApp. Te motivamos a invitarlo a learn.tg.',
      zionTitle: 'Posición Teológica (opcional)',
      zionQ1: '¿Cree que Dios tiene un plan de salvación para Israel étnico que opera mediante un pacto o dispensación separada, independiente de la fe en Jesucristo (ej. restauración de sacrificios levíticos en el milenio)?',
      zionQ2: '¿Cree que el verdadero Israel de Dios es exclusivamente el remanente de judíos y gentiles que creen en Jesús, y que las promesas territoriales se cumplen finalmente en la nueva creación?',
      zionQ3: 'Teniendo en cuenta que la CIJ ha señalado un "riesgo plausible de genocidio" en Gaza, la CPI ha emitido órdenes de arresto por crímenes de guerra, y la Comisión Independiente de Investigación de la ONU ha concluido que Israel ha cometido actos de genocidio en Gaza —incluyendo el targeting deliberado de niños—, ¿cree que los cristianos debemos respaldar incondicionalmente al Estado Moderno de Israel?',
    },
  })

  // Fetch country indicativo when countryId changes
  useEffect(() => {
    if (!countryId) { setIndicativo('+232'); return }
    fetch(`/api/countries`)
      .then(r => r.json())
      .then(data => {
        const c = (data || []).find((x: any) => x.id === countryId)
        if (c?.indicativo) setIndicativo(c.indicativo)
        else setIndicativo('+232')
      })
      .catch(() => setIndicativo('+232'))
  }, [countryId])

  const isPastor = churchRelationship === 'pastor'

  const handleSubmit = async () => {
    if (!name || !pastorName || !pastorWhatsapp) {
      toast({ title: t('fillRequired'), variant: 'destructive' })
      return
    }
    if (isPastor && (!registration || !registrationPhoto)) {
      toast({ title: lang === 'es' ? 'Número de registro y foto requeridos para pastores' : 'Registration number and photo required for pastors', variant: 'destructive' })
      return
    }

    if (!address) {
      toast({ title: t('noAuth'), variant: 'destructive' })
      return
    }

    setIsLoading(true)
    try {
      if (!session?.user) throw new Error('No session')

      // Upload registration photo first if present
      let photoPath = ''
      const csrfToken = await getCsrfToken()
      if (registrationPhoto) {
        const formData = new FormData()
        formData.append('photo', registrationPhoto)
        formData.append('side', 'registration')
        formData.append('walletAddress', address)
        formData.append('token', csrfToken || '')

        const photoRes = await fetch('/api/user/id-photo', { method: 'POST', body: formData })
        if (photoRes.ok) {
          const data = await photoRes.json()
          photoPath = data.path
        }
      }

      // Create church via API
      const res = await fetch('/api/church', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          token: csrfToken || '',
          name,
          address: churchAddress || undefined,
          countryId,
          cityName,
          pastorName,
          pastorWhatsapp,
          registration: isPastor ? registration : undefined,
          registrationPhoto: isPastor ? photoPath : undefined,
          zionQ1: zionQ1 || undefined,
          zionQ2: zionQ2 || undefined,
          zionQ3: zionQ3 || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('error'))
      }

      const data = await res.json()
      toast({ title: t('success') })
      onOpenChange(false)
      // Clear form state
      setName('')
      setChurchAddress('')
      setPastorName('')
      setPastorWhatsapp('')
      setRegistration('')
      setRegistrationPhoto(null)
      onSuccess?.(data.church?.id)
    } catch (error) {
      toast({ title: t('error'), description: error instanceof Error ? error.message : '', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('churchName')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('churchName')} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('churchAddress')}</label>
            <Input value={churchAddress} onChange={(e) => setChurchAddress(e.target.value)} placeholder={t('churchAddress')} />
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
            {t('pastorNote')}
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('pastorName')} *</label>
            <Input value={pastorName} onChange={(e) => setPastorName(e.target.value)} placeholder={t('pastorName')} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('pastorWhatsapp')} *</label>
            <div className="flex items-center">
              <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-gray-500 text-sm">
                {indicativo}
              </span>
              <Input
                value={pastorWhatsapp}
                onChange={(e) => setPastorWhatsapp(e.target.value)}
                className="rounded-l-none"
              />
            </div>
          </div>

          {isPastor && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('registration')} <span className="text-red-500 text-xs">({t('required')})</span>
                </label>
                <Input value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="REG-12345" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('registrationPhoto')} <span className="text-red-500 text-xs">({t('required')})</span>
                </label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => setRegistrationPhoto(e.target.files?.[0] || null)}
                  className="text-sm"
                />
              </div>
            </>
          )}
          {/* Zionism theological position */}
          <details className="border rounded p-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-600">
              {t('zionTitle')}
            </summary>
            <div className="mt-2 space-y-3">
              {[1, 2, 3].map(q => {
                const val = q === 1 ? zionQ1 : q === 2 ? zionQ2 : zionQ3
                const setVal = q === 1 ? setZionQ1 : q === 2 ? setZionQ2 : setZionQ3
                return (
                  <div key={q} className="space-y-1">
                    <p className="text-xs text-gray-600">{t(`zionQ${q}` as any)}</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1 text-sm">
                        <input type="radio" name={`zion_q${q}`} checked={val === 'yes'}
                          onChange={() => setVal(val === 'yes' ? '' : 'yes')} className="rounded" />
                        {lang === 'es' ? 'Sí' : 'Yes'}
                      </label>
                      <label className="flex items-center gap-1 text-sm">
                        <input type="radio" name={`zion_q${q}`} checked={val === 'no'}
                          onChange={() => setVal(val === 'no' ? '' : 'no')} className="rounded" />
                        No
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? '...' : t('register')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
