'use client'

// https://github.com/pasosdeJesus/learn.tg/issues/223 — explorador público de donaciones: detalle de las donaciones a
// bóvedas de curso, fondos de clúster/país y campañas, con el comentario del
// donante (procedencia de los fondos). Datos del ledger vía GET /api/donations
// (público, sin datos personales). Soporta enlaces directos con filtros:
// /{lang}/donations?type=course&courseId=3, ?type=country&countryCode=SL,
// ?type=cluster&clusterWallet=0x..., ?type=campaign&campaign=lensenia.

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface Donation {
  id: number
  date: string | null
  crypto: string
  amount: number
  hash: string | null
  type: 'course' | 'cluster' | 'country' | 'campaign' | 'unknown'
  destination: string
  donor: string | null
  comment: string | null
}

const FILTERS = ['all', 'course', 'cluster', 'country', 'campaign'] as const
type Filter = typeof FILTERS[number]

const explorerFor = (hash: string) => {
  const base = process.env.NEXT_PUBLIC_EXPLORER_TX || 'https://celo.blockscout.com/tx'
  return `${base}/${hash}`
}

export default function DonationsExplorerPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params)
  const sp = useSearchParams()
  const [filter, setFilter] = useState<Filter>(() => {
    const t = sp.get('type')
    return (FILTERS as readonly string[]).includes(t || '') ? (t as Filter) : 'all'
  })
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Donations',
      subtitle: 'Detail of donations to course vaults, cluster/country funds and campaigns, including the donor comment.',
      filterAll: 'All', filterCourse: 'Courses', filterCluster: 'Clusters', filterCountry: 'Countries', filterCampaign: 'Campaigns',
      date: 'Date', destination: 'Destination', donor: 'Donor', amount: 'Amount', comment: 'Comment', tx: 'Tx',
      none: 'No donations found for this filter.',
      loadFailed: 'Could not load donations. Try again later.',
      retry: 'Retry',
      anonymous: 'Anonymous',
      transparency: 'Transparency dashboard',
    },
    es: {
      title: 'Donaciones',
      subtitle: 'Detalle de las donaciones a bóvedas de curso, fondos de clúster/país y campañas, incluido el comentario del donante.',
      filterAll: 'Todas', filterCourse: 'Cursos', filterCluster: 'Clústeres', filterCountry: 'Países', filterCampaign: 'Campañas',
      date: 'Fecha', destination: 'Destino', donor: 'Donante', amount: 'Monto', comment: 'Comentario', tx: 'Tx',
      none: 'No hay donaciones para este filtro.',
      loadFailed: 'No se pudieron cargar las donaciones. Intenta más tarde.',
      retry: 'Reintentar',
      anonymous: 'Anónimo',
      transparency: 'Panel de transparencia',
    },
  }), [lang])

  const query = useCallback(() => {
    const parts = new URLSearchParams()
    if (filter !== 'all') parts.set('type', filter)
    const courseId = sp.get('courseId'); if (courseId) parts.set('courseId', courseId)
    const clusterWallet = sp.get('clusterWallet'); if (clusterWallet) parts.set('clusterWallet', clusterWallet)
    const countryCode = sp.get('countryCode'); if (countryCode) parts.set('countryCode', countryCode)
    const campaign = sp.get('campaign'); if (campaign) parts.set('campaign', campaign)
    parts.set('limit', '100')
    return parts.toString()
  }, [filter, sp])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/donations?${query()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setDonations(json.donations || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { load() }, [load])

  const filterLabel = (f: Filter) => t(
    ({ all: 'filterAll', course: 'filterCourse', cluster: 'filterCluster', country: 'filterCountry', campaign: 'filterCampaign' } as Record<Filter, string>)[f]
  )

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-800">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
          <a href={`/${lang}/transparency`} className="inline-block mt-2 text-xs text-blue-600 underline">
            {t('transparency')}
          </a>
        </header>

        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full border text-xs ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
              {filterLabel(f)}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-3">
            {t('loadFailed')} <button onClick={load} className="underline text-blue-600">{t('retry')}</button>
          </p>
        )}
        {!error && loading && <p className="text-sm text-gray-500">Loading...</p>}
        {!error && !loading && donations.length === 0 && <p className="text-sm text-gray-500">{t('none')}</p>}

        {donations.length > 0 && (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-md p-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-1 pr-2">{t('date')}</th>
                  <th className="py-1 pr-2">{t('destination')}</th>
                  <th className="py-1 pr-2">{t('donor')}</th>
                  <th className="py-1 pr-2 text-right">{t('amount')}</th>
                  <th className="py-1 pr-2">{t('comment')}</th>
                  <th className="py-1">{t('tx')}</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 align-top">
                    <td className="py-1 pr-2 whitespace-nowrap">{d.date ? new Date(d.date).toLocaleDateString() : '--'}</td>
                    <td className="py-1 pr-2">{d.destination}</td>
                    <td className="py-1 pr-2 truncate max-w-[10rem]">{d.donor || t('anonymous')}</td>
                    <td className="py-1 pr-2 text-right font-mono whitespace-nowrap">
                      {d.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {d.crypto.toUpperCase()}
                    </td>
                    <td className="py-1 pr-2 max-w-[18rem]">
                      {d.comment
                        ? <span title={d.comment} className="text-gray-600 italic break-words">{d.comment}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-1">
                      {d.hash
                        ? <a href={explorerFor(d.hash)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{d.hash.slice(0, 10)}…</a>
                        : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
