'use client'

// Página pública de un clúster (R-#299 §6): el encabezado es el **alias** (slug), nunca
// el nombre interno; muestra las iglesias que lo componen, el total recaudado, el estado
// del proceso y la transacción de liberación cuando ya recibió sus fondos. No publica
// pastores, billeteras ni invitaciones.
import { useEffect, useState, use } from 'react'
import Link from 'next/link'

interface PublicCluster {
  slug: string
  status: string | null
  gd_status: string | null
  finished: boolean
  created_at: string | null
  country_name: string | null
  country_code: string | null
  church_count: number
  churches: { name: string; joined_at: string | null }[]
  usdt_total: number
  slearn_total: number
  release: { at: string | null; amount: number | null; slearn: number | null; tx: string | null } | null
}

const IS_PRODUCTION =
  (process.env.NEXT_PUBLIC_AUTH_URL || '').toLowerCase() === 'https://learn.tg' ||
  (process.env.NEXT_PUBLIC_AUTH_URL || '').toLowerCase() === 'https://learntg.pdj.app'

const T = {
  en: {
    back: '← Back to the ranking',
    loading: 'Loading…',
    notFound: 'Cluster not found.',
    churches: 'Churches',
    raised: 'Raised on learn.tg',
    status: 'Process status',
    pending: 'Being formed',
    active: 'Formed: the three churches are in',
    finished: 'Finished: the fund was released',
    inProcess: 'In process with pdJ',
    presented: 'Presented to Global Disciples',
    answered: 'Global Disciples answered',
    release: 'Fund release transaction',
    none: '—',
  },
  es: {
    back: '← Volver al ranking',
    loading: 'Cargando…',
    notFound: 'Clúster no encontrado.',
    churches: 'Iglesias',
    raised: 'Recaudado en learn.tg',
    status: 'Estado del proceso',
    pending: 'En formación',
    active: 'Formado: ya están las tres iglesias',
    finished: 'Terminado: el fondo fue liberado',
    inProcess: 'En proceso con pdJ',
    presented: 'Presentado a Global Disciples',
    answered: 'Global Disciples respondió',
    release: 'Transacción de liberación del fondo',
    none: '—',
  },
} as const

export default function PublicClusterPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = use(params)
  const t = (key: keyof typeof T.en) => (lang === 'es' ? T.es[key] : T.en[key])
  const [cluster, setCluster] = useState<PublicCluster | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/clusters/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then((data) => setCluster(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  const statusLabel = (c: PublicCluster) => {
    if (c.finished) return t('finished')
    if (c.gd_status === 'answered') return t('answered')
    if (c.gd_status && ['sent', 'answered'].includes(c.gd_status)) return t('presented')
    if (c.gd_status && ['requested', 'under_review', 'returned', 'approved'].includes(c.gd_status)) return t('inProcess')
    return c.status === 'active' ? t('active') : t('pending')
  }

  return (
    <div className="max-w-2xl mx-auto p-6 mt-12">
      <Link href={`/${lang}/gdcluster/ranking`} className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        {t('back')}
      </Link>

      {loading && <p className="text-gray-500">{t('loading')}</p>}
      {notFound && <p className="text-red-600">{t('notFound')}</p>}

      {cluster && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 font-mono break-all">{cluster.slug}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {cluster.country_name ? `${cluster.country_name} · ` : ''}
            {cluster.church_count} {t('churches').toLowerCase()}
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">{t('raised')}</p>
              <p className="font-semibold">{Number(cluster.usdt_total ?? 0).toFixed(2)} USDT</p>
              <p className="font-semibold">{Number(cluster.slearn_total ?? 0).toFixed(2)} SLEARN</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">{t('status')}</p>
              <p className="font-semibold">{statusLabel(cluster)}</p>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">{t('churches')} ({cluster.church_count})</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {cluster.churches.map((church, i) => (
              <li key={i} className="flex items-center justify-between border-b border-gray-100 pb-1">
                <span>{church.name}</span>
              </li>
            ))}
          </ul>

          {cluster.release && (
            <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="text-xs text-gray-500 mb-1">{t('release')}</p>
              <p className="font-semibold">
                {Number(cluster.release.amount ?? 0).toFixed(2)} USDT / {Number(cluster.release.slearn ?? 0).toFixed(2)} SLEARN
              </p>
              {cluster.release.tx ? (
                <a
                  href={`${IS_PRODUCTION ? 'https://celoscan.io' : 'https://sepolia.celoscan.io'}/tx/${cluster.release.tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline break-all font-mono"
                >
                  {cluster.release.tx}
                </a>
              ) : (
                <p className="text-xs text-gray-500">{t('none')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
