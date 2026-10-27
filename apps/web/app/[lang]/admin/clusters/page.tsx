'use client'

// All Clusters — verifier view of the GD clusters (https://github.com/pasosdeJesus/learn.tg/issues/220 §5).
// Read-only list with search and filters; the verifier can edit name/pseudonym/status
// and disband (soft delete). Auth is the same list as the rest of /admin: the UI hides
// the page and every /api/admin/clusters/* route calls authenticateAdmin server-side.

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { adminFetch } from '@/lib/admin-fetch'

type PageProps = { params: Promise<{ lang: string }> }

const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)

type Cluster = {
  id: number
  name: string
  pseudonym: string | null
  code: string
  country_id: number
  status: string
  leader_church_id: number | null
  country_name: string | null
  leader_church_name: string | null
  member_count: number
  cluster_wallet: string | null
}

const STATUSES = ['pending', 'active', 'disbanded'] as const

export default function AdminClustersPage({ params }: PageProps) {
  const { lang } = use(params)
  const { address } = useAuthAddress()
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Cluster | null>(null)
  const [draft, setDraft] = useState({ name: '', pseudonym: '', status: 'pending' })
  const [saving, setSaving] = useState(false)

  const t = createComponentT(lang, {
    en: {
      title: 'All Clusters', accessDenied: 'Access denied. Verifier wallet required.',
      back: '← Back to dashboard', search: 'Search by name, pseudonym or code...',
      allStatuses: 'All statuses', allCountries: 'All countries',
      loading: 'Loading...', noClusters: 'No clusters found.', error: 'Could not load the clusters.',
      id: 'ID', name: 'Name', pseudonym: 'Pseudonym', code: 'Code',
      country: 'Country', leader: 'Leader church', members: 'Members',
      status: 'Status', actions: 'Actions', edit: 'Edit', disband: 'Disband',
      pending: 'Pending', active: 'Active', disbanded: 'Disbanded',
      editTitle: 'Edit cluster', save: 'Save', cancel: 'Cancel', saving: 'Saving...',
      disbandConfirm: 'Disband this cluster? It disappears from the ranking; the history stays.',
      saved: 'Saved', saveError: 'Could not save the cluster', disbandError: 'Could not disband the cluster',
    },
    es: {
      title: 'Todos los Clústeres', accessDenied: 'Acceso denegado. Se requiere billetera verificadora.',
      back: '← Volver al panel', search: 'Buscar por nombre, pseudónimo o código...',
      allStatuses: 'Todos los estados', allCountries: 'Todos los países',
      loading: 'Cargando...', noClusters: 'No se encontraron clústeres.', error: 'No se pudieron cargar los clústeres.',
      id: 'ID', name: 'Nombre', pseudonym: 'Pseudónimo', code: 'Código',
      country: 'País', leader: 'Iglesia líder', members: 'Miembros',
      status: 'Estado', actions: 'Acciones', edit: 'Editar', disband: 'Disolver',
      pending: 'Pendiente', active: 'Activo', disbanded: 'Disuelto',
      editTitle: 'Editar clúster', save: 'Guardar', cancel: 'Cancelar', saving: 'Guardando...',
      disbandConfirm: '¿Disolver este clúster? Sale del ranking; el historial se conserva.',
      saved: 'Guardado', saveError: 'No se pudo guardar el clúster', disbandError: 'No se pudo disolver el clúster',
    },
  })

  const statusLabel = (value: string) =>
    value === 'active' ? t('active') : value === 'disbanded' ? t('disbanded') : t('pending')

  const fetchClusters = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (status) params.set('status', status)
      if (country) params.set('country', country)
      const data = await adminFetch<{ clusters: Cluster[] }>(`/api/admin/clusters?${params}`)
      setClusters(data.clusters || [])
    } catch (err) {
      console.error('Failed to fetch clusters:', err)
      setError(t('error'))
      setClusters([])
    }
    setLoading(false)
  }, [search, status, country])

  useEffect(() => { fetchClusters() }, [fetchClusters])

  const isVerifier = address && VERIFIER_WALLETS.includes(address.toLowerCase())

  if (!isVerifier) {
    return <div className="max-w-4xl mx-auto p-6"><p className="text-red-600">{t('accessDenied')}</p></div>
  }

  const openEdit = (cluster: Cluster) => {
    setSelected(cluster)
    setDraft({
      name: cluster.name || '',
      pseudonym: cluster.pseudonym || '',
      status: cluster.status || 'pending',
    })
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await adminFetch(`/api/admin/clusters/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      setSelected(null)
      await fetchClusters()
    } catch (err) {
      console.error('Failed to update cluster:', err)
      setError(t('saveError'))
    }
    setSaving(false)
  }

  const disband = async (cluster: Cluster) => {
    if (!window.confirm(t('disbandConfirm'))) return
    try {
      await adminFetch(`/api/admin/clusters/${cluster.id}`, { method: 'DELETE' })
      await fetchClusters()
    } catch (err) {
      console.error('Failed to disband cluster:', err)
      setError(t('disbandError'))
    }
  }

  const countries = Array.from(
    new Map(
      clusters
        .filter(c => c.country_id && c.country_name)
        .map(c => [String(c.country_id), c.country_name as string]),
    ).entries(),
  )

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <Link href={`/${lang}/admin`} className="text-sm text-blue-600 hover:underline">{t('back')}</Link>
      <h1 className="text-2xl font-bold mb-4 mt-2">{t('title')} ({clusters.length})</h1>

      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('search')}
          className="w-full sm:w-96 border rounded px-3 py-2 text-sm"
        />
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          <option value="">{t('allStatuses')}</option>
          {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <select value={country} onChange={e => setCountry(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          <option value="">{t('allCountries')}</option>
          {countries.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {loading ? <p className="text-gray-500">{t('loading')}</p>
        : clusters.length === 0 ? <p className="text-gray-500">{t('noClusters')}</p>
        : (
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">{t('id')}</th>
                  <th className="px-3 py-2 text-left">{t('name')}</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">{t('pseudonym')}</th>
                  <th className="px-3 py-2 text-left hidden sm:table-cell">{t('code')}</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">{t('country')}</th>
                  <th className="px-3 py-2 text-left hidden lg:table-cell">{t('leader')}</th>
                  <th className="px-3 py-2 text-center hidden sm:table-cell">{t('members')}</th>
                  <th className="px-3 py-2 text-center">{t('status')}</th>
                  <th className="px-3 py-2 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map(c => (
                  <tr key={c.id} className="border-b hover:bg-blue-50">
                    <td className="px-3 py-2 font-mono text-xs">{c.id}</td>
                    <td className="px-3 py-2 font-medium">{c.name || '—'}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs">{c.pseudonym || '—'}</td>
                    <td className="px-3 py-2 hidden sm:table-cell font-mono text-xs">{c.code || '—'}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs">{c.country_name || '—'}</td>
                    <td className="px-3 py-2 hidden lg:table-cell text-xs">{c.leader_church_name || '—'}</td>
                    <td className="px-3 py-2 text-center hidden sm:table-cell text-xs">{c.member_count}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${c.status === 'active' ? 'bg-green-100 text-green-800' : c.status === 'disbanded' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800'}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <button onClick={() => openEdit(c)}
                        className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-100">
                        {t('edit')}
                      </button>
                      {c.status !== 'disbanded' && (
                        <button onClick={() => disband(c)}
                          className="text-xs text-red-600 hover:underline px-2 py-1 rounded hover:bg-red-50">
                          {t('disband')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{t('editTitle')} #{selected.id}</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-gray-600">{t('name')}</span>
                <input value={draft.name} maxLength={50}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('pseudonym')}</span>
                <input value={draft.pseudonym}
                  onChange={e => setDraft(d => ({ ...d, pseudonym: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('status')}</span>
                <select value={draft.status}
                  onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm">
                  {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setSelected(null)}
                className="px-3 py-2 text-sm border rounded">{t('cancel')}</button>
              <button onClick={save} disabled={saving}
                className="px-3 py-2 text-sm bg-primary text-white rounded disabled:opacity-50">
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
