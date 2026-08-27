'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminAuthParams } from '@/lib/admin-fetch'
import { createComponentT } from '@/lib/hooks/useTranslation'
import DonateModal from '@/components/DonateModal'
import type { ClusterDonation, CountryDonation } from '@learn-tg/gdcluster/lib/donation-target'

interface ClusterRow {
  id: number; name: string; country_name: string | null
  country_code: string | null; church_count: number; wallet: string
}

interface CountryRow {
  country_id: number; country_name: string | null
  country_code: string | null; cluster_count: number; church_count: number
}

export function RankingClient({ lang }: { lang: string }) {
  const t = createComponentT(lang, {
    en: {
      clustersTab: 'Clusters', countriesTab: 'Countries',
      cluster: 'Cluster', country: 'Country',
      churches: 'Churches', members: 'Members',
      fundUSDT: 'USDT Fund', fundSLEARN: 'SLEARN Fund',
      noData: 'No data yet.', loading: 'Loading...', donate: 'Donate',
    },
    es: {
      clustersTab: 'Clústeres', countriesTab: 'Países',
      cluster: 'Clúster', country: 'País',
      churches: 'Iglesias', members: 'Miembros',
      fundUSDT: 'Fondo USDT', fundSLEARN: 'Fondo SLEARN',
      noData: 'Aún no hay datos.', loading: 'Cargando...', donate: 'Donar',
    },
  })
  const [tab, setTab] = useState<'clusters' | 'countries'>('countries')
  const [clusters, setClusters] = useState<ClusterRow[]>([])
  const [countries, setCountries] = useState<CountryRow[]>([])
  const [funds, setFunds] = useState<{ clusters: any[], countries: any[] }>({ clusters: [], countries: [] })
  const [loading, setLoading] = useState(true)
  const [donateTarget, setDonateTarget] = useState<ClusterDonation | CountryDonation | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const auth = adminAuthParams()
    try {
      const [cRes, coRes, fRes] = await Promise.all([
        fetch(`/api/gdcluster/ranking/clusters?${auth}`),
        fetch(`/api/gdcluster/ranking/countries?${auth}`),
        fetch(`/api/gdcluster/ranking/funds?${auth}`),
      ])
      if (cRes.ok) setClusters((await cRes.json()).clusters || [])
      if (coRes.ok) setCountries((await coRes.json()).countries || [])
      if (fRes.ok) setFunds(await fRes.json())
    } catch (e) { /* public */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const findClusterFunds = (wallet: string) => funds.clusters.find(f => f.cluster_wallet?.toLowerCase() === wallet.toLowerCase())
  const findCountryFunds = (code: string) => funds.countries.find(f => f.country_code === code)

  if (loading) return <p className="text-gray-500">{t('loading')}</p>

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('clusters')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium ${tab === 'clusters' ? 'bg-white border border-b-0 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          🏘️ {t('clustersTab')} ({clusters.length})
        </button>
        <button onClick={() => setTab('countries')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium ${tab === 'countries' ? 'bg-white border border-b-0 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          🌍 {t('countriesTab')} ({countries.length})
        </button>
      </div>

      {tab === 'clusters' ? (
        <div className="overflow-x-auto bg-white rounded-b-lg rounded-tr-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left w-12">#</th>
                <th className="px-3 py-2 text-left">{t('cluster')}</th>
                <th className="px-3 py-2 text-left">{t('country')}</th>
                <th className="px-3 py-2 text-center">{t('churches')}</th>
                <th className="px-3 py-2 text-right">{t('fundUSDT')}</th>
                <th className="px-3 py-2 text-right">{t('fundSLEARN')}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {clusters.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">{t('noData')}</td></tr>
              ) : clusters.map((c, i) => (
                <tr key={c.id} className="border-b hover:bg-blue-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.country_code ? `${flagEmoji(c.country_code)} ${c.country_name}` : c.country_name || '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">{c.church_count}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {findClusterFunds(c.wallet)?.usdt_total.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {findClusterFunds(c.wallet)?.slearn_total.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => setDonateTarget({
                      type: 'cluster-donation',
                      clusterWallet: c.wallet,
                      clusterName: c.name,
                    })}
                    className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50">
                      {t('donate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-b-lg rounded-tr-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left w-12">#</th>
                <th className="px-3 py-2 text-left">{t('country')}</th>
                <th className="px-3 py-2 text-center">{t('clustersTab')}</th>
                <th className="px-3 py-2 text-center">{t('churches')}</th>
                <th className="px-3 py-2 text-right">{t('fundUSDT')}</th>
                <th className="px-3 py-2 text-right">{t('fundSLEARN')}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {countries.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">{t('noData')}</td></tr>
              ) : countries.map((c, i) => (
                <tr key={c.country_id} className="border-b hover:bg-blue-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    {c.country_code ? `${flagEmoji(c.country_code)} ` : ''}{c.country_name || '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">{c.cluster_count}</td>
                  <td className="px-3 py-2 text-center text-xs">{c.church_count}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {findCountryFunds(c.country_code || '')?.usdt_total.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {findCountryFunds(c.country_code || '')?.slearn_total.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => setDonateTarget({
                      type: 'country-donation',
                      countryCode: c.country_code || '',
                      countryName: c.country_name || '',
                    })}
                    className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50">
                      {t('donate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {donateTarget && (
        <DonateModal
          target={donateTarget}
          isOpen={true}
          onClose={() => setDonateTarget(null)}
          onSuccess={() => { fetchData(); setDonateTarget(null) }}
          lang={lang}
        />
      )}
    </div>
  )
}

function flagEmoji(iso2: string): string {
  if (iso2.length !== 2) return ''
  const a = iso2.toUpperCase().charCodeAt(0) + 127397
  const b = iso2.toUpperCase().charCodeAt(1) + 127397
  return String.fromCodePoint(a, b)
}
