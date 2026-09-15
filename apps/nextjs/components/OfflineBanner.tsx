'use client'

import { useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'

interface OfflineBannerProps {
  lang?: string
}

export function OfflineBanner({ lang = 'en' }: OfflineBannerProps) {
  const { isOffline } = useOfflineStatus()
  const t = useMemo(() => createComponentT(lang, {
    en: { offline: 'You are offline. Your progress will be saved locally.' },
    es: { offline: 'Estás sin conexión. Tu progreso se guardará localmente.' },
  }), [lang])

  if (!isOffline) return null

  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="bg-amber-100 text-amber-900 text-sm text-center px-3 py-2"
    >
      {t('offline')}
    </div>
  )
}
