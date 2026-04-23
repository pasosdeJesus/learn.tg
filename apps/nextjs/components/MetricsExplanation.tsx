interface MetricsExplanationProps {
  t: (en: string, es: string) => string
}

export function MetricsExplanation({ t }: MetricsExplanationProps) {
  return (
    <div className="text-sm text-muted-foreground">
      <p>
        <strong>{t('Learning Points', 'Puntos de Aprendizaje')}</strong>{' '}
        {t(
          'are earned by completing crosswords and giving donations.',
          'se ganan completando crucigramas y haciendo donaciones.'
        )}
      </p>
      <p>
        <strong>{t('Scholarship (USDT)', 'Beca (USDT)')}</strong>{' '}
        {t('is received as educational grants.', 'se recibe como becas educativas.')}
      </p>
      <p>
        <strong>{t('UBI (CELO)', 'UBI (CELO)')}</strong>{' '}
        {t(
          'is received through universal basic income claims.',
          'se recibe a través de reclamos de ingreso básico universal.'
        )}
      </p>
      <p>
        <strong>{t('Donations (USDT)', 'Donaciones (USDT)')}</strong>{' '}
        {t('are contributions made to support the platform.', 'son contribuciones hechas para apoyar la plataforma.')}
      </p>
    </div>
  )
}