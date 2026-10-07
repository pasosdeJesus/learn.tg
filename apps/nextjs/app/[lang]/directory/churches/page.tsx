'use client'

import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { CountryFilter } from '@learn-tg/gdcluster/components/CountryFilter'
import type { DirectoryEntry } from '@/lib/church-directory'

type PageProps = { params: Promise<{ lang: string }> }
type TFunc = (k: string) => string

interface DirectoryPayload {
  churches: DirectoryEntry[]
  total: number
  notRecommended: DirectoryEntry[]
  countries: { alfa2: string; nombre: string }[]
  denominations: string[]
}

export default function ChurchDirectoryPage({ params }: PageProps) {
  const { lang } = use(params)
  const [data, setData] = useState<DirectoryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState<string | null>(null)
  const [denominations, setDenominations] = useState<string[]>([])

  const t = createComponentT(lang, {
    en: {
      title: 'Church Directory',
      subtitle: 'Churches verified by Pasos de Jesús, with their activity and reputation.',
      loading: 'Loading...', none: 'No churches found.',
      denomination: 'Denomination', allDenominations: 'All denominations', clear: 'Clear',
      church: 'Church', activity: 'Activity', reputation: 'Reputation', members: 'Members', pastor: 'Pastor',
      notRecommended: 'Not recommended',
      notRecommendedNote: 'These churches are not recommended by the platform (unresolved dispute). Shown separately, without a position.',
    },
    es: {
      title: 'Directorio de Iglesias',
      subtitle: 'Iglesias verificadas por Pasos de Jesús, con su actividad y reputación.',
      loading: 'Cargando...', none: 'No se encontraron iglesias.',
      denomination: 'Denominación', allDenominations: 'Todas las denominaciones', clear: 'Limpiar',
      church: 'Iglesia', activity: 'Actividad', reputation: 'Reputación', members: 'Miembros', pastor: 'Pastor',
      notRecommended: 'No recomendadas',
      notRecommendedNote: 'Estas iglesias no son recomendadas por la plataforma (disputa no resuelta). Se muestran aparte, sin posición.',
    },
  })

  useEffect(() => {
    const qs = new URLSearchParams({ not_recommended: '1' })
    if (country) qs.set('country', country)
    for (const d of denominations) qs.append('denomination', d)
    setLoading(true)
    fetch(`/api/directory/churches?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setData({
          churches: d.churches || [],
          total: d.total || 0,
          notRecommended: d.notRecommended || [],
          countries: d.countries || [],
          denominations: d.denominations || [],
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, denominations.join(',')])

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <CountryFilter
            countries={data?.countries || []}
            selectedCountry={country}
            onCountryChange={setCountry}
            disabled={loading}
            lang={lang}
          />
          <DenominationMultiSelect
            options={data?.denominations || []}
            selected={denominations}
            onChange={setDenominations}
            t={t}
          />
        </div>
      </div>

      {loading ? <p className="text-muted-foreground">{t('loading')}</p>
        : !data || data.churches.length === 0 ? <p className="text-muted-foreground">{t('none')}</p>
        : (
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-3 py-2">{t('church')}</th>
                  <th className="px-3 py-2 hidden sm:table-cell">{t('pastor')}</th>
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
                      <div className="text-xs text-gray-400">{[c.denomination, c.cityName, c.countryName].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-xs">
                      {c.pastorId
                        ? <Link href={`/${lang}/user/${c.pastorId}`} className="text-blue-600 hover:underline">{c.pastorName || `#${c.pastorId}`}</Link>
                        : '—'}
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
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('notRecommended')}</h2>
          <p className="text-xs text-muted-foreground mb-2">{t('notRecommendedNote')}</p>
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-3 py-2">{t('church')}</th>
                  <th className="px-3 py-2 hidden sm:table-cell">{t('denomination')}</th>
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

/** Multi-select for the denominations present in the directory (checkbox dropdown). */
function DenominationMultiSelect({
  options, selected, onChange, t,
}: {
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  t: TFunc
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const toggle = (d: string) => onChange(
    selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d],
  )

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 w-[240px] border rounded-md px-3 py-2 text-sm bg-background"
      >
        <span className="text-muted-foreground">{t('denomination')}:</span>
        <span className="truncate">{selected.length ? `${selected.length}` : t('allDenominations')}</span>
        <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[280px] max-h-72 overflow-y-auto bg-white border rounded-md shadow-lg p-2">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground p-1">—</p>
          ) : (
            options.map((d) => (
              <label key={d} className="flex items-center gap-2 px-1 py-1 text-sm hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} />
                <span>{d}</span>
              </label>
            ))
          )}
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="text-xs text-blue-600 mt-1 px-1">
              {t('clear')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
