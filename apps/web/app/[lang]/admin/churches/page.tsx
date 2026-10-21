'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { adminFetch } from '@/lib/admin-fetch'
import { ChurchEditModal, type ChurchItem } from '@/components/admin/AdminWidgets'

type PageProps = { params: Promise<{ lang: string }> }
const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)

const PAGE_SIZE = 30

export default function AdminChurchesPage({ params }: PageProps) {
  const { lang } = use(params)
  const { address } = useAuthAddress()
  const [churches, setChurches] = useState<ChurchItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ChurchItem | null>(null)
  const [page, setPage] = useState(0)

  const t = createComponentT(lang, {
    en: {
      title: 'All Churches', accessDenied: 'Access denied. Verifier wallet required.',
      search: 'Search by name, pastor or city...', loading: 'Loading...',
      id: 'ID', name: 'Name', pastor: 'Pastor', country: 'Country',
      city: 'City', denomination: 'Denomination', registered: 'Registered',
      actions: 'Actions', edit: 'Edit', noChurches: 'No churches found.',
      previous: 'Previous', next: 'Next', pageInfo: 'Page {page}',
      yes: 'Yes', no: 'No',
    },
    es: {
      title: 'Todas las Iglesias', accessDenied: 'Acceso denegado. Se requiere billetera verificadora.',
      search: 'Buscar por nombre, pastor o ciudad...', loading: 'Cargando...',
      id: 'ID', name: 'Nombre', pastor: 'Pastor', country: 'País',
      city: 'Ciudad', denomination: 'Denominación', registered: 'Registrada',
      actions: 'Acciones', edit: 'Editar', noChurches: 'No se encontraron iglesias.',
      previous: 'Anterior', next: 'Siguiente', pageInfo: 'Página {page}',
      yes: 'Sí', no: 'No',
    },
  })

  const fetchChurches = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const data = await adminFetch<{ churches: ChurchItem[] }>(`/api/admin/churches?${params}`)
      setChurches(data.churches || [])
      setPage(0)
    } catch (err) {
      console.error('Failed to fetch churches:', err)
    }
    setLoading(false)
  }, [search])

  useEffect(() => { fetchChurches() }, [fetchChurches])

  const isVerifier = address && VERIFIER_WALLETS.includes(address.toLowerCase())

  if (!isVerifier) {
    return <div className="max-w-4xl mx-auto p-6"><p className="text-red-600">{t('accessDenied')}</p></div>
  }

  const totalPages = Math.ceil(churches.length / PAGE_SIZE)
  const pageChurches = churches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">{t('title')} ({churches.length})</h1>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('search')}
          className="w-full sm:w-96 border rounded px-3 py-2 text-sm"
        />
      </div>

      {loading ? <p className="text-gray-500">{t('loading')}</p>
        : pageChurches.length === 0 ? <p className="text-gray-500">{t('noChurches')}</p>
        : <>
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">{t('id')}</th>
                  <th className="px-3 py-2 text-left">{t('name')}</th>
                  <th className="px-3 py-2 text-left hidden sm:table-cell">{t('pastor')}</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">{t('country')}</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">{t('city')}</th>
                  <th className="px-3 py-2 text-left hidden lg:table-cell">{t('denomination')}</th>
                  <th className="px-3 py-2 text-center hidden sm:table-cell">{t('registered')}</th>
                  <th className="px-3 py-2 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pageChurches.map(ch => (
                  <tr key={ch.id} className="border-b hover:bg-blue-50">
                    <td className="px-3 py-2 font-mono text-xs">{ch.id}</td>
                    <td className="px-3 py-2 font-medium">{ch.name || '—'}</td>
                    <td className="px-3 py-2 hidden sm:table-cell text-xs">{ch.pastor_name || '—'}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs">{ch.country_name || '—'}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs">{ch.city_name || '—'}</td>
                    <td className="px-3 py-2 hidden lg:table-cell text-xs">{ch.denomination || '—'}</td>
                    <td className="px-3 py-2 text-center hidden sm:table-cell">
                      {ch.registration_verified
                        ? <span className="text-green-600 text-xs">✓ {t('yes')}</span>
                        : <span className="text-gray-400 text-xs">{t('no')}</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => { adminFetch(`/api/admin/church/${ch.id}`).then(setSelected).catch(() => {}) }}
                        className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-100">
                        {t('edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-3 text-sm">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1 border rounded disabled:opacity-30">{t('previous')}</button>
              <span className="text-gray-500">{t('pageInfo').replace('{page}', `${page + 1}/${totalPages}`)}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1 border rounded disabled:opacity-30">{t('next')}</button>
            </div>
          )}
        </>}

      {selected && (
        <ChurchEditModal lang={lang} t={t as any} church={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); fetchChurches() }} />
      )}
    </div>
  )
}
