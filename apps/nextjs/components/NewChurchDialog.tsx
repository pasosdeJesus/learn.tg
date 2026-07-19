'use client'

import { useState } from 'react'
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
  const [registration, setRegistration] = useState('')
  const [registrationPhoto, setRegistrationPhoto] = useState<File | null>(null)
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
    },
  })

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
                +232
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
