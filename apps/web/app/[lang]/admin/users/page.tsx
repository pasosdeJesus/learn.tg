'use client'

import { use, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { adminFetch } from '@/lib/admin-fetch'
import { UserEditModal, type UserItem } from '@/components/admin/AdminWidgets'
import Link from 'next/link'

type PageProps = { params: Promise<{ lang: string }> }
const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)

const PAGE_SIZE = 50
const DEBOUNCE_MS = 300

export default function AdminUsersPage({ params }: PageProps) {
  const { lang } = use(params)
  const { address } = useAuthAddress()
  const [users, setUsers] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UserItem | null>(null)
  const [page, setPage] = useState(0)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const t = createComponentT(lang, {
    en: {
      title: 'All Users', accessDenied: 'Access denied. Verifier wallet required.',
      search: 'Search by name, wallet or email...', loading: 'Loading...',
      id: 'ID', name: 'Name', wallet: 'Wallet', country: 'Country',
      church: 'Church', score: 'Score', actions: 'Actions',
      viewProfile: 'View Profile', edit: 'Edit', noUsers: 'No users found.',
      previous: 'Previous', next: 'Next', pageInfo: 'Page {page}',
    },
    es: {
      title: 'Todos los Usuarios', accessDenied: 'Acceso denegado. Se requiere billetera verificadora.',
      search: 'Buscar por nombre, billetera o email...', loading: 'Cargando...',
      id: 'ID', name: 'Nombre', wallet: 'Billetera', country: 'País',
      church: 'Iglesia', score: 'Puntaje', actions: 'Acciones',
      viewProfile: 'Ver Perfil', edit: 'Editar', noUsers: 'No se encontraron usuarios.',
      previous: 'Anterior', next: 'Siguiente', pageInfo: 'Página {page}',
    },
  })

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      const data = await adminFetch<{ users: UserItem[]; total: number }>(`/api/admin/users?${params}`)
      setUsers(data.users || [])
      setTotal(data.total || 0)
      setPage(0)
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
    setLoading(false)
  }, [debouncedSearch])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const isVerifier = address && VERIFIER_WALLETS.includes(address.toLowerCase())

  if (!isVerifier) {
    return <div className="max-w-4xl mx-auto p-6"><p className="text-red-600">{t('accessDenied')}</p></div>
  }

  const totalPages = Math.ceil(users.length / PAGE_SIZE)
  const pageUsers = users.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">{t('title')} ({users.length} / {total})</h1>

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
        : pageUsers.length === 0 ? <p className="text-gray-500">{t('noUsers')}</p>
        : <>
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">{t('id')}</th>
                  <th className="px-3 py-2 text-left">{t('name')}</th>
                  <th className="px-3 py-2 text-left hidden sm:table-cell">{t('wallet')}</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">{t('country')}</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">{t('church')}</th>
                  <th className="px-3 py-2 text-right">{t('score')}</th>
                  <th className="px-3 py-2 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.map(u => (
                  <tr key={u.id} className="border-b hover:bg-blue-50">
                    <td className="px-3 py-2 font-mono text-xs">{u.id}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{u.nombre || u.nusuario || '—'}</div>
                      {u.email && <div className="text-xs text-gray-400">{u.email}</div>}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <span className="font-mono text-xs text-gray-500">
                        {u.billetera ? `${u.billetera.slice(0, 6)}...${u.billetera.slice(-4)}` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs">{u.pais_nombre || '—'}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs max-w-[120px] truncate">
                      {(u as any).church_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <span className={((u.profilescore ?? 0) >= 50) ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {u.profilescore ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Link href={`/${lang}/user/${u.id}`}
                          target="_blank"
                          className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-100">
                          {t('viewProfile')}
                        </Link>
                        <button
                          onClick={() => { adminFetch(`/api/admin/user/${u.id}`).then(setSelected).catch(() => {}) }}
                          className="text-xs text-gray-600 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100">
                          {t('edit')}
                        </button>
                      </div>
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
        <UserEditModal lang={lang} t={t as any} user={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); fetchUsers() }} />
      )}
    </div>
  )
}
