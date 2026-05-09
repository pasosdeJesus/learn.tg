import { useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface MetricsExplanationProps {
  lang: string
}

export function MetricsExplanation({ lang }: MetricsExplanationProps) {
  const t = useMemo(() => createComponentT(lang, {
    en: {
      learningPoints: 'Learning Points',
      learningPointsDesc: 'are earned by completing crosswords and giving donations.',
      scholarship: 'Scholarship (USDT)',
      scholarshipDesc: 'is received as educational grants.',
      ubi: 'UBI (CELO)',
      ubiDesc: 'is received through universal basic income claims.',
      donations: 'Donations (USDT)',
      donationsDesc: 'are contributions made to support the platform.',
    },
    es: {
      learningPoints: 'Puntos de Aprendizaje',
      learningPointsDesc: 'se ganan completando crucigramas y haciendo donaciones.',
      scholarship: 'Beca (USDT)',
      scholarshipDesc: 'se recibe como becas educativas.',
      ubi: 'UBI (CELO)',
      ubiDesc: 'se recibe a través de reclamos de ingreso básico universal.',
      donations: 'Donaciones (USDT)',
      donationsDesc: 'son contribuciones hechas para apoyar la plataforma.',
    },
  }), [lang])
  return (
    <div className="text-sm text-muted-foreground">
      <p>
        <strong>{t('learningPoints')}</strong>{' '}
        {t('learningPointsDesc')}
      </p>
      <p>
        <strong>{t('scholarship')}</strong>{' '}
        {t('scholarshipDesc')}
      </p>
      <p>
        <strong>{t('ubi')}</strong>{' '}
        {t('ubiDesc')}
      </p>
      <p>
        <strong>{t('donations')}</strong>{' '}
        {t('donationsDesc')}
      </p>
    </div>
  )
}