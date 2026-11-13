'use client'

// All Clusters — verifier view of the GD clusters (https://github.com/pasosdeJesus/learn.tg/issues/220 §5).
// R-#299: read-only list with search and filters; the verifier edits the internal name,
// the public alias (slug) and the status, and disbands (soft delete). Auth is the same
// list as the rest of /admin: the UI hides the page and every /api/admin/clusters/*
// route calls authenticateAdmin server-side.

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
  slug: string
  country_id: number
  status: string
  initiator_church_id: number | null
  country_name: string | null
  initiator_church_name: string | null
  member_count: number
  cluster_wallet: string | null
  gd_requested_at: string | null
  gd_sent_at: string | null
  gd_response: string | null
  gd_contact_email: string | null
  gd_status: string | null
  gd_evaluation: string | null
  gd_suggestions: string | null
}

// Estados de la presentación a GD (R-#161); el motor valida las transiciones.
const GD_TRANSITIONS: Record<string, string[]> = {
  requested: ['under_review', 'returned', 'cancelled'],
  under_review: ['returned', 'approved', 'sent'],
  returned: ['approved', 'under_review'],
  approved: ['sent'],
  sent: ['answered'],
  answered: [],
  cancelled: [],
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
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<Cluster | null>(null)
  const [draft, setDraft] = useState({ name: '', slug: '', status: 'pending' })
  const [gdCluster, setGdCluster] = useState<any | null>(null)
  const [gdForm, setGdForm] = useState({ status: '', evaluation: '', suggestions: '', response: '', contactEmail: '' })
  const [gdSaving, setGdSaving] = useState(false)
  const [gdCopied, setGdCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const t = createComponentT(lang, {
    en: {
      title: 'All Clusters', accessDenied: 'Access denied. Verifier wallet required.',
      back: '← Back to dashboard', search: 'Search by name or alias...',
      allStatuses: 'All statuses', allCountries: 'All countries',
      loading: 'Loading...', noClusters: 'No clusters found.', error: 'Could not load the clusters.',
      id: 'ID', name: 'Name (internal)', slug: 'Public alias',
      country: 'Country', initiatorChurch: 'Initiator church', members: 'Members',
      status: 'Status', actions: 'Actions', edit: 'Edit', disband: 'Disband',
      gd: 'GD', gdTitle: 'Presentation to Global Disciples', gdRequested: 'Requested',
      gdEmailProposal: 'Suggested subject and body (copy, paste and edit them in your mail client)',
      gdCopyEmail: 'Copy the email', gdCopied: 'Copied', gdSent: 'Email sent to GD',
      gdMoveTo: 'Move the presentation to', gdSelectStatus: 'Choose the next state',
      gdEvaluation: 'Evaluation (visible to the initiator)', gdSuggestions: 'Suggestions (visible to the initiator)',
      gdStatusHelp: 'Sent means you already wrote to your GD contact; answered records the answer and the channel to continue.',
      gdStatusRequested: 'Requested', gdStatusUnderReview: 'Under review', gdStatusReturned: 'Returned',
      gdStatusApproved: 'Approved', gdStatusSent: 'Sent', gdStatusAnswered: 'Answered', gdStatusCancelled: 'Cancelled',
      gdResponse: 'Answer from GD (visible to the initiator)', gdContactEmail: 'Email or channel GD indicates',
      gdSaved: 'Saved', gdSaveError: 'Could not save the GD data',
      pending: 'Pending', active: 'Active', disbanded: 'Disbanded',
      editTitle: 'Edit cluster', save: 'Save', cancel: 'Cancel', saving: 'Saving...',
      disbandConfirm: 'Disband this cluster? It disappears from the ranking; the history stays.',
      saved: 'Saved', saveError: 'Could not save the cluster', disbandError: 'Could not disband the cluster',
    },
    es: {
      title: 'Todos los Clústeres', accessDenied: 'Acceso denegado. Se requiere billetera verificadora.',
      back: '← Volver al panel', search: 'Buscar por nombre o alias...',
      allStatuses: 'Todos los estados', allCountries: 'Todos los países',
      loading: 'Cargando...', noClusters: 'No se encontraron clústeres.', error: 'No se pudieron cargar los clústeres.',
      id: 'ID', name: 'Nombre (interno)', slug: 'Alias público',
      country: 'País', initiatorChurch: 'Iglesia iniciadora', members: 'Miembros',
      status: 'Estado', actions: 'Acciones', edit: 'Editar', disband: 'Disolver',
      gd: 'GD', gdTitle: 'Presentación a Global Disciples', gdRequested: 'Solicitada',
      gdEmailProposal: 'Tema y cuerpo sugeridos (cópialos, pégalos y ajústalos en tu cliente de correo)',
      gdCopyEmail: 'Copiar el correo', gdCopied: 'Copiado', gdSent: 'Correo enviado a GD',
      gdMoveTo: 'Mover la presentación a', gdSelectStatus: 'Elige el siguiente estado',
      gdEvaluation: 'Evaluación (visible para el iniciador)', gdSuggestions: 'Sugerencias (visible para el iniciador)',
      gdStatusHelp: 'Sent significa que ya escribiste a tu contacto en GD; answered registra la respuesta y el canal para continuar.',
      gdStatusRequested: 'Solicitada', gdStatusUnderReview: 'En revisión', gdStatusReturned: 'Devuelta',
      gdStatusApproved: 'Aprobada', gdStatusSent: 'Enviada', gdStatusAnswered: 'Respondida', gdStatusCancelled: 'Cancelada',
      gdResponse: 'Respuesta de GD (visible para el iniciador)', gdContactEmail: 'Correo o canal que indica GD',
      gdSaved: 'Guardado', gdSaveError: 'No se pudo guardar lo de GD',
      pending: 'Pendiente', active: 'Activo', disbanded: 'Disuelto',
      editTitle: 'Editar clúster', save: 'Guardar', cancel: 'Cancelar', saving: 'Guardando...',
      disbandConfirm: '¿Disolver este clúster? Sale del ranking; el historial se conserva.',
      saved: 'Guardado', saveError: 'No se pudo guardar el clúster', disbandError: 'No se pudo disolver el clúster',
    },
  })

  const statusLabel = (value: string) =>
    value === 'active' ? t('active') : value === 'disbanded' ? t('disbanded') : t('pending')

  const gdStatusLabel = (value: string) => {
    const key: Record<string, any> = {
      requested: 'gdStatusRequested', under_review: 'gdStatusUnderReview', returned: 'gdStatusReturned',
      approved: 'gdStatusApproved', sent: 'gdStatusSent', answered: 'gdStatusAnswered', cancelled: 'gdStatusCancelled',
    }
    return key[value] ? t(key[value]) : value
  }

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

  const openGd = async (cluster: Cluster) => {
    setNotice('')
    setGdForm({
      status: '',
      evaluation: cluster.gd_evaluation || '',
      suggestions: cluster.gd_suggestions || '',
      response: cluster.gd_response || '',
      contactEmail: cluster.gd_contact_email || '',
    })
    setGdCluster(cluster)
    try {
      const detail = await adminFetch<{ cluster: any }>(`/api/admin/clusters/${cluster.id}`)
      setGdCluster(detail.cluster || cluster)
    } catch (err) {
      console.error('Failed to load the cluster detail:', err)
    }
  }

  const saveGd = async () => {
    if (!gdCluster) return
    setGdSaving(true)
    try {
      await adminFetch(`/api/cluster/${gdCluster.id}/gd-presentation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          status: gdForm.status,
          evaluation: gdForm.evaluation,
          suggestions: gdForm.suggestions,
          response: gdForm.response,
          contactEmail: gdForm.contactEmail,
        }),
      })
      setGdCluster(null)
      setNotice(t('gdSaved'))
      await fetchClusters()
    } catch (err) {
      console.error('Failed to save the GD data:', err)
      setError(t('gdSaveError'))
    }
    setGdSaving(false)
  }

  // Solo se sugiere el tema y el cuerpo: pdJ los copia y los envía desde su propio
  // cliente de correo al contacto de GD que ya tenga. La aplicación no conoce esa
  // dirección (decisión del operador, 2026-10-28; antes salía de NEXT_PUBLIC_GD_CONTACT_EMAIL).
  const gdEmailText = (cluster: any) => {
    const subject = `Cluster ${cluster.name} (${cluster.code}) - presentation to Global Disciples`
    const members = (cluster.members || []).map((m: any) => m.church_name).join(', ')
    const body = [
      'Hello,',
      '',
      `We present the cluster ${cluster.name} (code ${cluster.code}) of ${cluster.country_name || ''},`,
      `in advanced formation, for the Global Disciples academy process.`,
      '',
      `Initiator church: ${cluster.initiator_church_name || cluster.initiator_church?.name || ''}`,
      `Cluster wallet: ${cluster.cluster_wallet || ''}`,
      `Member churches: ${members}`,
      '',
      'Please help us with the contact of the nearest program director (in the country or',
      'abroad), or with the channel you suggest so the cluster can continue directly with',
      'Global Disciples.',
      '',
      'Thank you.',
    ].join('\n')
    return `Subject: ${subject}

${body}`
  }

  const copyGdEmail = async (cluster: any) => {
    try {
      await navigator.clipboard.writeText(gdEmailText(cluster))
      setGdCopied(true)
      setTimeout(() => setGdCopied(false), 2000)
    } catch (err) {
      console.error('Could not copy the email:', err)
    }
  }

  const openEdit = (cluster: Cluster) => {
    setNotice('')
    setSelected(cluster)
    setDraft({
      name: cluster.name || '',
      slug: cluster.slug || '',
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
    setNotice('')
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
      {notice && <p className="text-green-700 text-sm mb-3">{notice}</p>}

      {loading ? <p className="text-gray-500">{t('loading')}</p>
        : clusters.length === 0 ? <p className="text-gray-500">{t('noClusters')}</p>
        : (
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">{t('id')}</th>
                  <th className="px-3 py-2 text-left">{t('name')}</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">{t('slug')}</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">{t('country')}</th>
                  <th className="px-3 py-2 text-left hidden lg:table-cell">{t('initiatorChurch')}</th>
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
                    <td className="px-3 py-2 hidden md:table-cell font-mono text-xs">{c.slug || '—'}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs">{c.country_name || '—'}</td>
                    <td className="px-3 py-2 hidden lg:table-cell text-xs">{c.initiator_church_name || '—'}</td>
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
                      {c.gd_requested_at && (
                        <button onClick={() => openGd(c)}
                          className="text-xs text-purple-700 hover:underline px-2 py-1 rounded hover:bg-purple-50">
                          {t('gd')}
                        </button>
                      )}
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

      {gdCluster && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">{t('gdTitle')}</h2>
            <p className="text-xs text-gray-500 mb-4">
              {gdCluster.name} · {gdCluster.code} · {gdStatusLabel(gdCluster.gd_status || 'requested')} · {t('gdRequested')}: {gdCluster.gd_requested_at ? new Date(gdCluster.gd_requested_at).toLocaleString(lang) : '—'}
            </p>
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-700">{t('gdEmailProposal')}</p>
                <textarea readOnly value={gdEmailText(gdCluster)} rows={12}
                  className="w-full border rounded px-3 py-2 text-xs font-mono bg-gray-50" />
                <button type="button" onClick={() => copyGdEmail(gdCluster)}
                  className="text-xs text-blue-600 hover:underline">
                  {gdCopied ? t('gdCopied') : t('gdCopyEmail')}
                </button>
              </div>
              <label className="block text-sm">
                <span className="text-gray-600">{t('gdMoveTo')}</span>
                <select value={gdForm.status}
                  onChange={e => setGdForm(f => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm">
                  <option value="">{t('gdSelectStatus')}</option>
                  {(GD_TRANSITIONS[gdCluster.gd_status || ''] || []).map((next: string) => (
                    <option key={next} value={next}>{gdStatusLabel(next)}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-gray-500">{t('gdStatusHelp')}</span>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('gdEvaluation')}</span>
                <textarea value={gdForm.evaluation} rows={2}
                  onChange={e => setGdForm(f => ({ ...f, evaluation: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('gdSuggestions')}</span>
                <textarea value={gdForm.suggestions} rows={3}
                  onChange={e => setGdForm(f => ({ ...f, suggestions: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('gdContactEmail')}</span>
                <input value={gdForm.contactEmail}
                  onChange={e => setGdForm(f => ({ ...f, contactEmail: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('gdResponse')}</span>
                <textarea value={gdForm.response} rows={4}
                  onChange={e => setGdForm(f => ({ ...f, response: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setGdCluster(null)}
                className="px-3 py-2 text-sm border rounded">{t('cancel')}</button>
              <button onClick={saveGd} disabled={gdSaving}
                className="px-3 py-2 text-sm bg-primary text-white rounded disabled:opacity-50">
                {gdSaving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
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
                <span className="text-gray-600">{t('slug')}</span>
                <input value={draft.slug} maxLength={40}
                  onChange={e => setDraft(d => ({ ...d, slug: e.target.value.toLowerCase() }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono" />
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
