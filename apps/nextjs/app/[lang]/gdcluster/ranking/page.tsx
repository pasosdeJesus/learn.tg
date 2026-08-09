import { RankingClient } from './RankingClient'

type PageProps = { params: Promise<{ lang: string }> }

export default async function RankingPage({ params }: PageProps) {
  const { lang } = await params
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">🏆 {lang === 'es' ? 'Ranking de Clústeres y Países' : 'Cluster & Country Ranking'}</h1>
      <RankingClient lang={lang} />
    </div>
  )
}
