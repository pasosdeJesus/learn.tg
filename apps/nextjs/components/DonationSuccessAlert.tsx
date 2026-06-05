'use client'

import { useMemo } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@pasosdejesus/m/shadcn-components/ui/alert'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface DonationSuccessAlertProps {
  increment: number
  onClose: () => void
  lang: string
}

export function DonationSuccessAlert({
  increment,
  onClose,
  lang,
}: DonationSuccessAlertProps) {
  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Donation Successful!',
      desc: 'You have earned {{0}} SLEARN.',
    },
    es: {
      title: '¡Donación Exitosa!',
      desc: 'Has ganado {{0}} SLEARN.',
    },
  }), [lang])

  return (
    <Alert className="fixed top-5 right-5 w-auto bg-green-100 border-green-400 text-green-700 max-w-sm z-50">
      <AlertTitle>{t('title')}</AlertTitle>
      <AlertDescription>
        {t('desc', String(increment))}
      </AlertDescription>
      <button onClick={onClose} className="absolute top-1 right-1 text-lg">
        &times;
      </button>
    </Alert>
  )
}
