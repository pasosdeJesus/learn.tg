'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAccount } from 'wagmi'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@pasosdejesus/m/shadcn-components/ui/dialog'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { Input } from '@pasosdejesus/m/shadcn-components/ui/input'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface Props {
  lang?: string
  onSuccess?: () => void
}

export function DeleteVerifiedDataDialog({ lang = 'en', onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { data: session } = useSession()
  const { address } = useAccount()

  const t = createComponentT(lang, {
    en: {
      delete: 'Delete Verified Data',
      title: 'Delete Verified Data?',
      description: 'This will permanently remove all verified fields from your account and reset your profile score to 0. This action CANNOT be undone.',
      confirmLabel: 'Type "DELETE" to confirm',
      confirmPlaceholder: 'DELETE',
      cancel: 'Cancel',
      confirm: 'Delete',
      success: 'Verified data deleted successfully',
      error: 'Failed to delete verified data',
      unauthorized: 'You must be connected to delete verified data',
    },
    es: {
      delete: 'Eliminar Información Verificada',
      title: '¿Eliminar Datos Verificados?',
      description: 'Esto eliminará permanentemente todos los campos verificados de tu cuenta y reiniciará tu puntaje de perfil a 0. Esta acción NO se puede deshacer.',
      confirmLabel: 'Escribe "ELIMINAR" para confirmar',
      confirmPlaceholder: 'ELIMINAR',
      cancel: 'Cancelar',
      confirm: 'Eliminar',
      success: 'Datos verificados eliminados correctamente',
      error: 'Error al eliminar datos verificados',
      unauthorized: 'Debes estar conectado para eliminar datos verificados',
    },
  })

  const isConfirmed = confirmText === 'DELETE' || confirmText === 'ELIMINAR'

  const handleDelete = async () => {
    if (!session?.address || !address) {
      toast({ title: t('unauthorized'), variant: 'destructive' })
      return
    }

    setIsLoading(true)
    try {
      const token = (session.user as any)?.token
      if (!token) {
        toast({ title: t('unauthorized'), variant: 'destructive' })
        return
      }

      const res = await fetch('/api/user/verified-data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address.toLowerCase(),
          token,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t('error'))
      }

      toast({ title: t('success') })
      setOpen(false)
      setConfirmText('')
      onSuccess?.()
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">{t('delete')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            {t('confirmLabel')}
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('confirmPlaceholder')}
            className="uppercase"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isLoading}
          >
            {isLoading ? '...' : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteVerifiedDataDialog