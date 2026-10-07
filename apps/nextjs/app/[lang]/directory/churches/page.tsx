'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { createComponentT } from '@/lib/hooks/useTranslation'
import type { DirectoryEntry } from '@/lib/church-directory'

type PageProps = { params: Promise<{ lang: string }> }

export default function ChurchDirectoryPage({ params }: PageProps) {
  const { lang } = use(params)
  const [data, setData] = useState<{ churches: DirectoryEntry[]; total: number; notRecommended: DirectoryEntry[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState('')
  const [denomination, setDenomination] = useState('')

  const t = createComponentT(lang, {
    en: {
      title: 'Church directory',
      subtitle: 'Churches verified by Pasos de Jesús, with their activity and reputation.',
      loading: 'Loading...', none: 'No churches found.',
      country: 'Country', denomination: 'Denomination', filter: 'Filter',
      activity: 'Activity', reputation: 'Reputation', members: 'Members', pastor: 'Pastor',
      notRecommended: 'Not recommended',
      notRecommendedNote: 'These churches are not recommended by the platform (unresolved dispute). Shown separately, without a position.',
    },
    es: {
      title: 'Directorio de iglesias',
      subtitle: 'Iglesias verificadas por Pasos de Jesús, con su actividad y reputación.',
      loading: 'Cargando...', none: 'No se encontraron iglesias.',
      country: 'País', denomination: 'Denominación', filter: 'Filtrar',
      activity: 'Actividad', reputation: 'Reputación', members: 'Miembros', pastor: 'Pastor',
      notRecommended: 'No recomendadas',
      notRecommendedNote: 'Estas iglesias no son recomendadas por la plataforma (disputa no resuelta). Se muestran aparte, sin posición.',
    },
  })

  useEffect(() => {
    const qs = new URLSearchParams({ not_recommended: '1' })
    if (country) qs.set('country', country)
    if (denomination) qs.set('denomination', denomination)
    setLoading(true)
    fetch(`/api/directory/churches?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => { setData({ churches: d.churches || [], total: d.total || 0, notRecommended: d.notRecommended || [] }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [country, denomination])

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">{t('title')}</h1>
      <p className="text-sm text-gray-500 mb-4">{t('subtitle')}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t('country')}
          className="border rounded px-3 py-1.5 text-sm" />
        <input value={denomination} onChange={(e) => setDenomination(e.target.value)} placeholder={t('denomination')}
          className="border rounded px-3 py-1.5 text-sm" />
      </div>

      {loading ? <p className="text-gray-500">{t('loading')}</p>
        : !data || data.churches.length === 0 ? <p className="text-gray-500">{t('none')}</p>
        : (
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-3 py-2">{t('title')}</th>
                  <th className="px-3 py-2 hidden sm:table-cell">{t('country')}</th>
                  <th className="px-3 py-2 hidden md:table-cell">{t('pastor')}</th>
                  <th className="px-3 py-2 text-right">{t('reputation')}</th>
                  <th className="px-3 py-2 text-right">{t('activity')}</th>
                  <th className="px-3 py-2 text-right">{t('members')}</th>
                </tr>
              </thead>
              <tbody>
                {data.churches.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-blue-50">
                    <td className="px-3 py-2">
                      <Link href={`/${lang}/directory/churches/${c.id}`} className="text-blue-600 hover:underline">
                        {c.name}
                      </Link>
                      {c.denomination && <div className="text-xs text-gray-400">{c.denomination}</div>}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-xs">{c.countryName || '—'}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs">
                      {c.pastorId ? <Link href={`/${lang}/user/${c.pastorId}`} className="text-blue-600 hover:underline">{c.pastorName || `#${c.pastorId}`}</Link> : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">{c.reputationScore}</td>
                    <td className="px-3 py-2 text-right text-xs">{c.activityScore ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-xs">{c.amountMember ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {data && data.notRecommended.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-lg mb-1">{t('notRecommended')}</h2>
          <p className="text-xs text-gray-500 mb-2">{t('notRecommendedNote')}</p>
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-3 py-2">{t('title')}</th>
                  <th className="px-3 py-2 hidden sm:table-cell">{t('country')}</th>
                  <th className="px-3 py-2">{t('notRecommended')}</th>
                </tr>
              </thead>
              <tbody>
                {data.notRecommended.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2 hidden sm:table-cell text-xs">{c.countryName || '—'}</td>
                    <td className="px-3 py-2 text-xs text-amber-700">{t('notRecommended')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
