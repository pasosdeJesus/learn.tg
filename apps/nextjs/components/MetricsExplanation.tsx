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
      verdes: 'Greens',
      verdesDesc: 'are the sum of the approved guides and the guides paid in USDT and in SLEARN (the main ranking measure).',
      guidesApproved: 'Approved guides',
      guidesApprovedDesc: 'are the guides the student passed (the checkmark).',
      guidesUsdt: 'Guides paid in USDT',
      guidesUsdtDesc: 'are the guides whose USDT scholarship was paid.',
      guidesSlearn: 'Guides paid in SLEARN',
      guidesSlearnDesc: 'are the guides whose SLEARN scholarship was paid.',
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
      verdes: 'Verdes',
      verdesDesc: 'son la suma de las guías aprobadas y de las guías pagadas en USDT y en SLEARN (la medida principal del ranking).',
      guidesApproved: 'Guías aprobadas',
      guidesApprovedDesc: 'son las guías que el estudiante aprobó (el chulo).',
      guidesUsdt: 'Guías pagadas en USDT',
      guidesUsdtDesc: 'son las guías cuya beca en USDT se pagó.',
      guidesSlearn: 'Guías pagadas en SLEARN',
      guidesSlearnDesc: 'son las guías cuya beca en SLEARN se pagó.',
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
      <p>
        <strong>{t('verdes')}</strong>{' '}
        {t('verdesDesc')}
      </p>
      <p>
        <strong>{t('guidesApproved')}</strong>{' '}
        {t('guidesApprovedDesc')}
      </p>
      <p>
        <strong>{t('guidesUsdt')}</strong>{' '}
        {t('guidesUsdtDesc')}
      </p>
      <p>
        <strong>{t('guidesSlearn')}</strong>{' '}
        {t('guidesSlearnDesc')}
      </p>
    </div>
  )
}