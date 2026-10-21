// Ranking de clústeres y países — el componente vive en el motor gdcluster
// (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §13, RankingClient con deps inyectadas D2); la app consume el
// adapter del host (lib/gdcluster-ui.tsx).
import { RankingClientHost } from '@/lib/gdcluster-ui'

type PageProps = { params: Promise<{ lang: string }> }

export default async function RankingPage({ params }: PageProps) {
  const { lang } = await params
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">🏆 {lang === 'es' ? 'Ranking de Clústeres y Países' : 'Cluster & Country Ranking'}</h1>
      <RankingClientHost lang={lang} />
    </div>
  )
}
