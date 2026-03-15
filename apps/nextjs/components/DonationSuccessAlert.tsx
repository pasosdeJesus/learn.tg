'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

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
  const t = (en: string, es: string) => (lang === 'es' ? es : en)

  return (
    <Alert className="fixed top-5 right-5 w-auto bg-green-100 border-green-400 text-green-700 max-w-sm z-50">
      <AlertTitle>{t('Donation Successful!', '¡Donación Exitosa!')}</AlertTitle>
      <AlertDescription>
        {t(
          `You have earned ${increment} learning points.`,
          `Has ganado ${increment} puntos de aprendizaje.`,
        )}
      </AlertDescription>
      <button onClick={onClose} className="absolute top-1 right-1 text-lg">
        &times;
      </button>
    </Alert>
  )
}
