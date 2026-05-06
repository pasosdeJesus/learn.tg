/**
 * Metrics Dashboard Page
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { getAllMetrics } from '@/lib/metrics/queries'
import { createTranslator } from '@pasosdejesus/m/i18n'
import type { TranslationSet } from '@pasosdejesus/m/i18n'

const pageT: TranslationSet = {
  en: {
    title: 'Learn.tg Metrics Dashboard',
    desc: 'Analytics and insights to measure platform performance and user engagement',
    completionRate: 'Completion Rate',
    completionDesc: 'Percentage of guides completed successfully across all courses',
    retentionByCooldown: 'Retention by Cooldown',
    retentionDesc: 'User retention rates based on 24-hour cooldown periods',
    timeBetween: 'Time Between Guides',
    timeDesc: 'Distribution of time users take between completing consecutive guides',
    userGrowth: 'User Growth Timeline',
    userGrowthDesc: 'New user registrations and active users over time',
    gameEngagement: 'Game Type Engagement',
    gameEngagementDesc: 'User engagement and completion rates by game type',
    goodDollarClaims: 'GoodDollar Claims Over Time',
    goodDollarClaimsDesc: 'Daily count of GoodDollar UBI claims by users.',
    dataUpdated: 'Data Last Updated:',
    loading: 'Loading...',
    loadingCompletion: 'Loading completion data...',
    loadingRetention: 'Loading retention data...',
    loadingTime: 'Loading time distribution data...',
    loadingGrowth: 'Loading user growth data...',
    loadingGame: 'Loading game engagement data...',
    loadingGoodDollar: 'Loading GoodDollar claim data...',
  },
  es: {
    title: 'Panel de Metricas de Learn.tg',
    desc: 'Analiticas para medir el rendimiento de la plataforma y la participacion de los usuarios',
    completionRate: 'Tasa de Finalizacion',
    completionDesc: 'Porcentaje de guias completadas exitosamente en todos los cursos',
    retentionByCooldown: 'Retencion por Periodo',
    retentionDesc: 'Tasas de retencion basadas en periodos de espera de 24 horas',
    timeBetween: 'Tiempo Entre Guias',
    timeDesc: 'Distribucion del tiempo entre guias consecutivas',
    userGrowth: 'Crecimiento de Usuarios',
    userGrowthDesc: 'Nuevos registros y usuarios activos a lo largo del tiempo',
    gameEngagement: 'Participacion por Tipo de Juego',
    gameEngagementDesc: 'Participacion y finalizacion por tipo de juego',
    goodDollarClaims: 'Reclamos de GoodDollar',
    goodDollarClaimsDesc: 'Conteo diario de reclamos UBI de GoodDollar.',
    dataUpdated: 'Datos actualizados:',
    loading: 'Cargando...',
    loadingCompletion: 'Cargando datos de finalizacion...',
    loadingRetention: 'Cargando datos de retencion...',
    loadingTime: 'Cargando datos de tiempo...',
    loadingGrowth: 'Cargando datos de crecimiento...',
    loadingGame: 'Cargando datos de juegos...',
    loadingGoodDollar: 'Cargando datos de GoodDollar...',
  },
}

const CompletionRateChart = dynamic(() => import('./components/CompletionRateChart'))
const RetentionByCooldownChart = dynamic(() => import('./components/RetentionByCooldownChart'))
const TimeBetweenGuidesHistogram = dynamic(() => import('./components/TimeBetweenGuidesHistogram'))
const UserGrowthTimeline = dynamic(() => import('./components/UserGrowthTimeline'))
const GameTypeEngagementChart = dynamic(() => import('./components/GameTypeEngagementChart'))
const GoodDollarClaimsChart = dynamic(() => import('./components/GoodDollarClaimsChart'))

interface Props {
  params: Promise<{ lang: string }>
}

export default async function MetricsDashboardPage({ params }: Props) {
  const { lang } = await params
  const t = createTranslator(lang, pageT)
  const metrics = await getAllMetrics()
  const { completionRate, retention, timeBetweenGuides, userGrowth, gameEngagement, goodDollarClaims, lastUpdated } = metrics

  return (
    <div className="container mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-600 mt-2">{t('desc')}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{t('completionRate')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('completionDesc')}</p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">{t('loadingCompletion')}</div>}>
            <CompletionRateChart data={completionRate} lang={lang} />
          </Suspense>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{t('retentionByCooldown')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('retentionDesc')}</p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">{t('loadingRetention')}</div>}>
            <RetentionByCooldownChart data={retention} lang={lang} />
          </Suspense>
        </section>

        <section className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">{t('timeBetween')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('timeDesc')}</p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">{t('loadingTime')}</div>}>
            <TimeBetweenGuidesHistogram data={timeBetweenGuides} lang={lang} />
          </Suspense>
        </section>

        <section className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">{t('userGrowth')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('userGrowthDesc')}</p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">{t('loadingGrowth')}</div>}>
            <UserGrowthTimeline data={userGrowth} lang={lang} />
          </Suspense>
        </section>

        <section className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">{t('gameEngagement')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('gameEngagementDesc')}</p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">{t('loadingGame')}</div>}>
            <GameTypeEngagementChart data={gameEngagement} lang={lang} />
          </Suspense>
        </section>

        <section className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">{t('goodDollarClaims')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('goodDollarClaimsDesc')}</p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">{t('loadingGoodDollar')}</div>}>
            <GoodDollarClaimsChart data={goodDollarClaims} lang={lang} />
          </Suspense>
        </section>
      </div>

      <footer className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
        <p>
          <strong>{t('dataUpdated')}</strong> {new Date(lastUpdated).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US')} {new Date(lastUpdated).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US')}
        </p>
      </footer>
    </div>
  )
}
