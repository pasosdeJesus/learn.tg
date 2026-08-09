import { createComponentT } from '@/lib/hooks/useTranslation'
import { RankingClient } from './RankingClient'

type PageProps = { params: Promise<{ lang: string }> }

export default async function RankingPage({ params }: PageProps) {
  const { lang } = await params

  const t = createComponentT(lang, {
    en: {
      title: 'Cluster & Country Ranking',
      clustersTab: 'Clusters',
      countriesTab: 'Countries',
      cluster: 'Cluster', country: 'Country',
      churches: 'Churches', members: 'Members',
      fundUSDT: 'USDT Fund', fundSLEARN: 'SLEARN Fund',
      score: 'Score', noData: 'No data yet.',
      loading: 'Loading...', donate: 'Donate',
    },
    es: {
      title: 'Ranking de Clústeres y Países',
      clustersTab: 'Clústeres',
      countriesTab: 'Países',
      cluster: 'Clúster', country: 'País',
      churches: 'Iglesias', members: 'Miembros',
      fundUSDT: 'Fondo USDT', fundSLEARN: 'Fondo SLEARN',
      score: 'Puntaje', noData: 'Aún no hay datos.',
      loading: 'Cargando...', donate: 'Donar',
    },
  })

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">🏆 {t('title')}</h1>
      <RankingClient lang={lang} t={t} />
    </div>
  )
}
