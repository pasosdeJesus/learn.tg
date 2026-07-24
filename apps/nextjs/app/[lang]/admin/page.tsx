'use client'

import { use, useEffect, useState } from 'react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'

type PageProps = { params: Promise<{ lang: string }> }
const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)

export default function AdminDashboard({ params }: PageProps) {
  const { lang } = use(params)
  const { address } = useAuthAddress()

  const t = createComponentT(lang, {
    en: {
      title: 'Verification Dashboard', accessDenied: 'Access denied. Verifier wallet required.',
      loading: 'Loading...', recentUsers: 'Recent Users', recentChurches: 'Recent Churches',
      pendingVerifications: 'Pending Verifications', calendar: 'My Calendar',
      notConfigured: 'NEXT_PUBLIC_VERIFIER_WALLET not set',
      noEvents: 'No events', noPending: 'No pending verifications',
      noUsers: 'No users', noChurches: 'No churches',
      blockTime: 'Block Time', addBlock: 'Add Block',
      interview: 'Interview', blocked: 'Blocked',
      wallet: 'Wallet', name: 'Name', country: 'Country',
      score: 'Score', role: 'Role', date: 'Date',
      pastor: 'Pastor', city: 'City', denomination: 'Denomination',
      proposed: 'Proposed',
    },
    es: {
      title: 'Panel de Verificación', accessDenied: 'Acceso denegado. Se requiere billetera de verificador.',
      loading: 'Cargando...', recentUsers: 'Usuarios Recientes', recentChurches: 'Iglesias Recientes',
      pendingVerifications: 'Verificaciones Pendientes', calendar: 'Mi Calendario',
      notConfigured: 'NEXT_PUBLIC_VERIFIER_WALLET no configurado',
      noEvents: 'Sin eventos', noPending: 'Sin verificaciones pendientes',
      noUsers: 'Sin usuarios', noChurches: 'Sin iglesias',
      blockTime: 'Bloquear Horario', addBlock: 'Agregar Bloqueo',
      interview: 'Entrevista', blocked: 'Bloqueado',
      wallet: 'Billetera', name: 'Nombre', country: 'País',
      score: 'Puntaje', role: 'Rol', date: 'Fecha',
      pastor: 'Pastor', city: 'Ciudad', denomination: 'Denominación',
      proposed: 'Propuesta',
    },
  })

  if (VERIFIER_WALLETS.length === 0) {
    return <div className="container mx-auto py-16 px-4 text-center"><p className="text-amber-600">{t('notConfigured')}</p></div>
  }
  if (!address || !VERIFIER_WALLETS.includes(address.toLowerCase())) {
    return <div className="container mx-auto py-16 px-4 text-center"><p className="text-red-600 font-medium">{t('accessDenied')}</p></div>
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">🛡️ {t('title')}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <CalendarWidget lang={lang} t={t} />
          <PendingWidget lang={lang} t={t} />
        </div>
        <div className="space-y-6">
          <RecentUsersWidget lang={lang} t={t} />
          <RecentChurchesWidget lang={lang} t={t} />
        </div>
      </div>
    </div>
  )
}

/* ── Calendar Widget ── */

interface CalEvent { uid: string; start: string; end: string; summary?: string }

function CalendarWidget({ lang, t }: { lang: string; t: (k: string) => string }) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showBlock, setShowBlock] = useState(false)

  const fetchEvents = () => {
    setLoading(true)
    fetch('/api/admin/calendar/events')
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(fetchEvents, [])

  const formatDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString(lang === 'es' ? 'es' : 'en', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const formatTime = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleTimeString(lang === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-lg">📅 {t('calendar')}</h2>
        <button onClick={() => setShowBlock(true)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
          + {t('blockTime')}
        </button>
      </div>

      {showBlock && <BlockTimeDialog lang={lang} t={t} onClose={() => setShowBlock(false)} onSaved={() => { setShowBlock(false); fetchEvents() }} />}

      {loading ? <p className="text-gray-500 text-sm">{t('loading')}</p>
        : events.length === 0 ? <p className="text-gray-500 text-sm">{t('noEvents')}</p>
        : <div className="space-y-1 max-h-64 overflow-y-auto">
          {events.map((e, i) => (
            <div key={e.uid || i} className="flex items-center gap-3 text-sm py-1 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500 w-20 shrink-0">{formatDate(e.start)}</span>
              <span className="text-xs font-medium w-16 shrink-0">{formatTime(e.start)}</span>
              <span className={e.summary?.toLowerCase().includes('block') ? 'text-red-600' : 'text-green-700'}>
                {e.summary || t('blocked')}
              </span>
            </div>
          ))}
        </div>}
    </div>
  )
}

/* ── Block Time Dialog ── */

function BlockTimeDialog({ lang, t, onClose, onSaved }: { lang: string; t: (k: string) => string; onClose: () => void; onSaved: () => void }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [summary, setSummary] = useState('Blocked')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!start || !end) return
    setSaving(true)
    await fetch('/api/admin/calendar/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary, start: new Date(start).toISOString(), end: new Date(end).toISOString() }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 className="font-semibold text-lg mb-4">{t('addBlock')}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">{lang === 'es' ? 'Inicio' : 'Start'}</label>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{lang === 'es' ? 'Fin' : 'End'}</label>
            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{lang === 'es' ? 'Motivo' : 'Reason'}</label>
            <input type="text" value={summary} onChange={e => setSummary(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">{lang === 'es' ? 'Cancelar' : 'Cancel'}</button>
          <button onClick={handleSave} disabled={saving || !start || !end} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Guardar' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Pending Verifications Widget ── */

interface UserItem {
  id: number; nombre?: string; nusuario?: string; billetera?: string
  pais_nombre?: string; profilescore?: number; church_relationship?: string
  proposed_date_of_interview?: string; created_at?: string
}

function PendingWidget({ lang, t }: { lang: string; t: (k: string) => string }) {
  const [items, setItems] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/admin/users?status=pending')
      .then(r => r.json()).then(d => { setItems(d.users || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString(lang === 'es' ? 'es' : 'en') : '—'

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">⏳ {t('pendingVerifications')} ({items.length})</h2>
      {loading ? <p className="text-gray-500 text-sm">{t('loading')}</p>
        : items.length === 0 ? <p className="text-gray-500 text-sm">{t('noPending')}</p>
        : <div className="space-y-2 max-h-64 overflow-y-auto">
          {items.map(u => (
            <div key={u.id} className="border-b pb-2 text-sm">
              <div className="flex justify-between items-start">
                <span className="font-medium">{u.nombre || u.nusuario || '—'}</span>
                <span className="text-xs text-blue-600">{t('proposed')}: {fmtDate(u.proposed_date_of_interview)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {u.billetera ? `${u.billetera.slice(0, 6)}...${u.billetera.slice(-4)}` : ''}
                {u.pais_nombre ? ` · ${u.pais_nombre}` : ''}
                {u.church_relationship ? ` · ${u.church_relationship}` : ''}
              </div>
            </div>
          ))}
        </div>}
    </div>
  )
}

/* ── Recent Users Widget ── */

function RecentUsersWidget({ lang, t }: { lang: string; t: (k: string) => string }) {
  const [items, setItems] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/admin/users/recent')
      .then(r => r.json()).then(d => { setItems(d.users || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString(lang === 'es' ? 'es' : 'en') : '—'

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">👤 {t('recentUsers')}</h2>
      {loading ? <p className="text-gray-500 text-sm">{t('loading')}</p>
        : items.length === 0 ? <p className="text-gray-500 text-sm">{t('noUsers')}</p>
        : <div className="space-y-2 max-h-64 overflow-y-auto">
          {items.map(u => (
            <div key={u.id} className="border-b pb-2 text-sm">
              <div className="flex justify-between items-start">
                <span className="font-medium">{u.nombre || u.nusuario || '—'}</span>
                <span className="text-xs text-gray-400">{fmtDate(u.created_at)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {u.billetera ? `${u.billetera.slice(0, 6)}...${u.billetera.slice(-4)}` : ''}
                {u.pais_nombre ? ` · ${u.pais_nombre}` : ''}
                {u.profilescore != null ? ` · ${t('score')}: ${u.profilescore}` : ''}
                {u.church_relationship ? ` · ${u.church_relationship}` : ''}
              </div>
            </div>
          ))}
        </div>}
    </div>
  )
}

/* ── Recent Churches Widget ── */

interface ChurchItem {
  id: number; name?: string; pastor_name?: string
  city_name?: string; denomination?: string
  country_name?: string; created_at?: string
}

function RecentChurchesWidget({ lang, t }: { lang: string; t: (k: string) => string }) {
  const [items, setItems] = useState<ChurchItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/admin/churches/recent')
      .then(r => r.json()).then(d => { setItems(d.churches || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString(lang === 'es' ? 'es' : 'en') : '—'

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">🏛️ {t('recentChurches')}</h2>
      {loading ? <p className="text-gray-500 text-sm">{t('loading')}</p>
        : items.length === 0 ? <p className="text-gray-500 text-sm">{t('noChurches')}</p>
        : <div className="space-y-2 max-h-64 overflow-y-auto">
          {items.map(ch => (
            <div key={ch.id} className="border-b pb-2 text-sm">
              <div className="flex justify-between items-start">
                <span className="font-medium">{ch.name || '—'}</span>
                <span className="text-xs text-gray-400">{fmtDate(ch.created_at)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {ch.pastor_name ? `${t('pastor')}: ${ch.pastor_name}` : ''}
                {ch.city_name ? ` · ${ch.city_name}` : ''}
                {ch.country_name ? ` · ${ch.country_name}` : ''}
                {ch.denomination ? ` · ${ch.denomination}` : ''}
              </div>
            </div>
          ))}
        </div>}
    </div>
  )
}
