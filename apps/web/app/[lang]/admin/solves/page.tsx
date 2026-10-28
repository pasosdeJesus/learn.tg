'use client'

// Asuntos por resolver (`admin_solves`) — https://github.com/pasosdeJesus/learn.tg/issues/161
//
// Cola de fallos posteriores a un movimiento de dinero (por ejemplo, el 10% del curso
// GD que no se pudo registrar en `transaction`). El verificador revisa el `metadata`,
// corrige el ledger y marca la fila como resuelta con una nota. La plataforma no
// reintenta sola: esa es la decisión por ahora, porque cada tipo de asunto necesita una
// comprobación distinta (hash de la transferencia, curso, usuario).
//
// Auth: la UI se oculta sin billetera verificadora y las rutas `/api/admin/solves/*`
// llaman `authenticateAdmin` en el servidor.

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { adminFetch } from '@/lib/admin-fetch'
import type { SolveRow, SolvesPayload } from '@/components/admin/AdminSolvesWidget'

type PageProps = { params: Promise<{ lang: string }> }

const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)

export default function AdminSolvesPage({ params }: PageProps) {
  const { lang } = use(params)
  const { address } = useAuthAddress()
  const [status, setStatus] = useState<'pending' | 'solved' | 'all'>('pending')
  const [type, setType] = useState('')
  const [data, setData] = useState<SolvesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const t = createComponentT(lang, {
    en: {
      title: 'Issues to resolve', accessDenied: 'Access denied. Verifier wallet required.',
      back: '← Back to dashboard', loading: 'Loading...', error: 'Could not load the queue.',
      pending: 'Pending', solved: 'Resolved', all: 'All', status: 'Status', type: 'Type',
      allTypes: 'All types', created: 'Created', metadata: 'Data', action: 'Action',
      resolve: 'Mark resolved', resolving: 'Saving...', note: 'Note (what was done)',
      resolvedBy: 'Resolved by', empty: 'No items in this filter.',
      resolvedOk: 'Item marked as resolved', resolveError: 'Could not mark it as resolved',
      noType: 'No pending items',
    },
    es: {
      title: 'Asuntos por resolver', accessDenied: 'Acceso denegado. Se requiere billetera verificadora.',
      back: '← Volver al panel', loading: 'Cargando...', error: 'No se pudo cargar la cola.',
      pending: 'Pendientes', solved: 'Resueltos', all: 'Todos', status: 'Estado', type: 'Tipo',
      allTypes: 'Todos los tipos', created: 'Creado', metadata: 'Datos', action: 'Acción',
      resolve: 'Marcar resuelto', resolving: 'Guardando...', note: 'Nota (qué se hizo)',
      resolvedBy: 'Resuelto por', empty: 'No hay asuntos con este filtro.',
      resolvedOk: 'Asunto marcado como resuelto', resolveError: 'No se pudo marcar como resuelto',
      noType: 'Sin pendientes',
    },
  })

  const isVerifier = address && VERIFIER_WALLETS.includes(address.toLowerCase())

  const load = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams({ status, limit: '100' })
      if (type) params.set('type', type)
      const d = await adminFetch<SolvesPayload>(`/api/admin/solves?${params.toString()}`)
      setData(d)
    } catch (err) {
      console.error('Failed to load admin_solves:', err)
      setError(t('error'))
    }
    setLoading(false)
  }, [status, type, t])

  useEffect(() => { if (isVerifier) load() }, [isVerifier, load])

  const resolve = async (item: SolveRow) => {
    setSavingId(String(item.id))
    setError('')
    try {
      await adminFetch(`/api/admin/solves/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: notes[String(item.id)] || undefined }),
      })
      setNotice(t('resolvedOk'))
      await load()
    } catch (err) {
      console.error('Failed to resolve admin_solve:', err)
      setError(t('resolveError'))
    }
    setSavingId(null)
  }

  if (!isVerifier) {
    return <div className="max-w-4xl mx-auto p-6"><p className="text-red-600">{t('accessDenied')}</p></div>
  }

  const types = (data?.counts || []).map(c => c.type)
  if (data?.type && !types.includes(data.type)) types.push(data.type)

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link href={`/${lang}/admin`} className="text-sm text-blue-600 hover:underline">{t('back')}</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{t('title')}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {t('pending')}: <strong>{data?.pendingTotal ?? 0}</strong>
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {notice && <p className="text-green-700 text-sm mb-3">{notice}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        {(['pending', 'solved', 'all'] as const).map(s => (
          <button key={s} onClick={() => { setStatus(s); setNotice('') }}
            className={`rounded border px-3 py-1 text-sm ${status === s ? 'bg-primary text-white!' : 'hover:bg-gray-50'}`}>
            {t(s)}
          </button>
        ))}
        <select value={type} onChange={e => { setType(e.target.value); setNotice('') }}
          className="border rounded px-2 py-1 text-sm">
          <option value="">{t('allTypes')}</option>
          {types.map(ty => <option key={ty} value={ty}>{ty}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-500">{t('loading')}</p>
        : !data || data.items.length === 0 ? <p className="text-gray-500">{t('empty')}</p>
        : (
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">{t('type')}</th>
                  <th className="px-3 py-2 text-left">{t('created')}</th>
                  <th className="px-3 py-2 text-left">{t('metadata')}</th>
                  <th className="px-3 py-2 text-left">{t('status')}</th>
                  <th className="px-3 py-2 text-center">{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr key={String(item.id)} className="border-b align-top">
                    <td className="px-3 py-2 font-mono text-xs">{String(item.id)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.type}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString(lang === 'es' ? 'es' : 'en')}
                    </td>
                    <td className="px-3 py-2">
                      <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap text-xs text-gray-700">
                        {JSON.stringify(item.metadata ?? {}, null, 1)}
                      </pre>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {item.solved_at ? (
                        <div className="space-y-1">
                          <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-green-800">{t('solved')}</span>
                          <div className="text-gray-500">
                            {new Date(item.solved_at).toLocaleString(lang === 'es' ? 'es' : 'en')}
                            {item.solved_by_name ? ` · ${t('resolvedBy')}: ${item.solved_by_name}` : ''}
                          </div>
                          {item.note && <div className="text-gray-600 italic">{item.note}</div>}
                        </div>
                      ) : (
                        <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-amber-800">{t('pending')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {!item.solved_at && (
                        <div className="space-y-1">
                          <input value={notes[String(item.id)] || ''}
                            onChange={e => setNotes(n => ({ ...n, [String(item.id)]: e.target.value }))}
                            placeholder={t('note')}
                            className="w-40 border rounded px-2 py-1 text-xs" />
                          <button onClick={() => resolve(item)} disabled={savingId === String(item.id)}
                            className="rounded bg-primary px-2 py-1 text-xs font-semibold text-white! disabled:opacity-50">
                            {savingId === String(item.id) ? t('resolving') : t('resolve')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
