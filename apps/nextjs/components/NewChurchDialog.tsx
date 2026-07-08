'use client'

import { useState } from 'react'
import { useSession, getCsrfToken } from 'next-auth/react'
import { useAccount } from 'wagmi'
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
  onSuccess?: () => void
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
  const [pastorName, setPastorName] = useState('')
  const [pastorWhatsapp, setPastorWhatsapp] = useState('')
  const [registration, setRegistration] = useState('')
  const [registrationPhoto, setRegistrationPhoto] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { data: session } = useSession()
  const { address } = useAccount()

  const t = createComponentT(lang, {
    en: {
      title: 'Register New Church',
      churchName: 'Church name',
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
    },
    es: {
      title: 'Registrar Nueva Iglesia',
      churchName: 'Nombre de la iglesia',
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

      toast({ title: t('success') })
      onOpenChange(false)
      // Clear form state
      setName('')
      setPastorName('')
      setPastorWhatsapp('')
      setRegistration('')
      setRegistrationPhoto(null)
      onSuccess?.()
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
            <label className="text-sm font-medium">{t('pastorName')} *</label>
            <Input value={pastorName} onChange={(e) => setPastorName(e.target.value)} placeholder={t('pastorName')} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('pastorWhatsapp')} *</label>
            <Input value={pastorWhatsapp} onChange={(e) => setPastorWhatsapp(e.target.value)} placeholder="+232 12345678" />
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
