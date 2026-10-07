'use client'

import { use, useState } from 'react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { adminFetch } from '@/lib/admin-fetch'

type PageProps = { params: Promise<{ lang: string }> }
const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',').map((w) => w.trim().toLowerCase()).filter(Boolean)

const REASONS = ['dishonesty', 'sexual_abuse', 'zionism', 'other']

export default function AdminReputationPage({ params }: PageProps) {
  const { lang } = use(params)
  const { address } = useAuthAddress()
  const [pastorId, setPastorId] = useState('')
  const [reason, setReason] = useState('dishonesty')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [resolveId, setResolveId] = useState('')
  const [resolveNotes, setResolveNotes] = useState('')
  const [replyReceived, setReplyReceived] = useState(false)
  const [resolveMsg, setResolveMsg] = useState('')

  const t = createComponentT(lang, {
    en: {
      title: 'Reputation — record evidence',
      accessDenied: 'Access denied. Verifier wallet required.',
      pastorId: 'Pastor user id', reason: 'Reason', notes: 'Private notes',
      files: 'Evidence files (at least one)', save: 'Record evidence', saving: 'Recording...',
      saved: 'Evidence recorded (id {id}).', required: 'A pastor id and at least one file are required.',
      resolveTitle: 'Resolve a case',
      resolveHint: 'A verifier other than the one who recorded the evidence must resolve it (nobody is judge in their own cause).',
      evidenceId: 'Evidence id', resolveNotes: 'Resolution notes', replyReceived: 'The accused replied (right of reply)',
      resolve: 'Resolve', resolving: 'Resolving...', resolved: 'Case resolved.',
    },
    es: {
      title: 'Reputación — registrar evidencia',
      accessDenied: 'Acceso denegado. Se requiere billetera verificadora.',
      pastorId: 'Id de usuario del pastor', reason: 'Motivo', notes: 'Notas privadas',
      files: 'Archivos de evidencia (al menos uno)', save: 'Registrar evidencia', saving: 'Registrando...',
      saved: 'Evidencia registrada (id {id}).', required: 'Se requiere un id de pastor y al menos un archivo.',
      resolveTitle: 'Resolver un caso',
      resolveHint: 'Debe resolverlo un verificador distinto del que registró la evidencia (nadie es juez en su propia causa).',
      evidenceId: 'Id de la evidencia', resolveNotes: 'Notas de resolución', replyReceived: 'El acusado respondió (derecho de réplica)',
      resolve: 'Resolver', resolving: 'Resolviendo...', resolved: 'Caso resuelto.',
    },
  })

  const isVerifier = address && VERIFIER_WALLETS.includes(address.toLowerCase())
  if (!isVerifier) {
    return <div className="max-w-2xl mx-auto p-6"><p className="text-red-600">{t('accessDenied')}</p></div>
  }

  const submit = async () => {
    setMsg('')
    if (!pastorId || !files || files.length === 0) { setMsg(t('required')); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('reason', reason)
      fd.set('notes', notes)
      for (const f of Array.from(files)) fd.append('files', f)
      const data = await adminFetch<{ evidence_id: number }>(`/api/admin/reputation/pastor/${pastorId}/evidence`, { method: 'POST', body: fd })
      setMsg(t('saved').replace('{id}', String(data.evidence_id)))
    } catch (e: any) {
      setMsg(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const resolve = async () => {
    setResolveMsg('')
    if (!resolveId) return
    setBusy(true)
    try {
      await adminFetch(`/api/admin/reputation/evidence/${resolveId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: resolveNotes, reply_received: replyReceived }),
      })
      setResolveMsg(t('resolved'))
    } catch (e: any) {
      setResolveMsg(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>

      <div className="space-y-3 bg-white border rounded-lg p-4">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{t('pastorId')}</label>
          <input value={pastorId} onChange={(e) => setPastorId(e.target.value)} inputMode="numeric"
            className="w-full border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{t('reason')}</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{t('notes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{t('files')}</label>
          <input type="file" multiple onChange={(e) => setFiles(e.target.files)} className="text-sm" />
        </div>
        <button onClick={submit} disabled={busy}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {busy ? t('saving') : t('save')}
        </button>
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-2">{t('resolveTitle')}</h2>
      <p className="text-xs text-gray-500 mb-2">{t('resolveHint')}</p>
      <div className="space-y-3 bg-white border rounded-lg p-4">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{t('evidenceId')}</label>
          <input value={resolveId} onChange={(e) => setResolveId(e.target.value)} inputMode="numeric"
            className="w-full border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{t('resolveNotes')}</label>
          <textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} rows={2}
            className="w-full border rounded px-2 py-1 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={replyReceived} onChange={(e) => setReplyReceived(e.target.checked)} />
          {t('replyReceived')}
        </label>
        <button onClick={resolve} disabled={busy}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {busy ? t('resolving') : t('resolve')}
        </button>
        {resolveMsg && <p className="text-sm text-gray-700">{resolveMsg}</p>}
      </div>
    </div>
  )
}
