'use client'

import { use, useEffect, useState } from 'react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'

type PageProps = { params: Promise<{ lang: string }> }
const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)

type TFunc = (k: string) => string

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
      pastor: 'Pastor', city: 'Ciudad', denomination: 'Denomination',
      proposed: 'Proposed', editUser: 'Edit User', editChurch: 'Edit Church',
      save: 'Save', cancel: 'Cancel', delete: 'Delete',
      saveSuccess: 'Saved', deleteConfirm: 'Delete this church?',
      verifiedFields: 'Verified Fields', profileFields: 'Profile Fields',
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
      proposed: 'Propuesta', editUser: 'Editar Usuario', editChurch: 'Editar Iglesia',
      save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar',
      saveSuccess: 'Guardado', deleteConfirm: '¿Eliminar esta iglesia?',
      verifiedFields: 'Campos Verificados', profileFields: 'Campos de Perfil',
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

/* ── Shared Modal Shell ── */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── Calendar Widget ── */

interface CalEvent { uid: string; start: string; end: string; summary?: string }

function CalendarWidget({ lang, t }: { lang: string; t: TFunc }) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showBlock, setShowBlock] = useState(false)

  const fetchEvents = () => {
    setLoading(true)
    fetch('/api/admin/calendar/events')
      .then(r => r.json())
      .then(d => {
        const now = new Date()
        const upcoming = (d.events || [])
          .filter((e: CalEvent) => new Date(e.end) >= now)
          .slice(0, 5)
        setEvents(upcoming)
        setLoading(false)
      })
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

function BlockTimeDialog({ lang, t, onClose, onSaved }: { lang: string; t: TFunc; onClose: () => void; onSaved: () => void }) {
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
    <Modal title={t('addBlock')} onClose={onClose}>
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
        <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">{t('cancel')}</button>
        <button onClick={handleSave} disabled={saving || !start || !end} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? (lang === 'es' ? 'Guardando...' : 'Saving...') : t('save')}
        </button>
      </div>
    </Modal>
  )
}

/* ── User Item (shared) ── */

interface UserItem {
  id: number; nombre?: string; nusuario?: string; billetera?: string
  pais_nombre?: string; profilescore?: number; church_relationship?: string
  proposed_date_of_interview?: string; conducted_date_of_interview?: string
  created_at?: string; email?: string; whatsapp?: string; telegram?: string
  passport_name?: string; passport_nationality?: string
  city_id?: number; place_of_worship?: string
  verified_whatsapp?: string; verified_telegram?: string; verified_email?: string
  verified_city_id?: number; verified_place_of_worship?: string
  verified_church_relationship?: string
}

const VERIFIED_FIELDS = [
  { key: 'verified_whatsapp', source: 'whatsapp', labelEn: 'WhatsApp', labelEs: 'WhatsApp' },
  { key: 'verified_telegram', source: 'telegram', labelEn: 'Telegram', labelEs: 'Telegram' },
  { key: 'verified_email', source: 'email', labelEn: 'Email', labelEs: 'Correo' },
  { key: 'verified_city_id', source: 'city_id', labelEn: 'City/ID', labelEs: 'Ciudad/ID' },
  { key: 'verified_place_of_worship', source: 'place_of_worship', labelEn: 'Place of Worship', labelEs: 'Lugar de Culto' },
  { key: 'verified_church_relationship', source: null, labelEn: 'Church Role', labelEs: 'Rol en Iglesia' },
]

function fmtDate(s?: string, lang?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString(lang === 'es' ? 'es' : 'en')
}

function shortAddr(a?: string) {
  if (!a) return ''
  return `${a.slice(0, 6)}...${a.slice(-4)}`
}

/* ── Pending Verifications Widget ── */

function PendingWidget({ lang, t }: { lang: string; t: TFunc }) {
  const [items, setItems] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UserItem | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    fetch('/api/admin/users?status=pending')
      .then(r => r.json()).then(d => { setItems(d.users || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [refresh])

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">⏳ {t('pendingVerifications')} ({items.length})</h2>
      {loading ? <p className="text-gray-500 text-sm">{t('loading')}</p>
        : items.length === 0 ? <p className="text-gray-500 text-sm">{t('noPending')}</p>
        : <div className="space-y-1 max-h-64 overflow-y-auto">
          {items.map(u => (
            <div key={u.id} className="border-b border-gray-100 pb-2 text-sm cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-2"
              onClick={() => { fetch(`/api/admin/user/${u.id}`).then(r => r.json()).then(setSelected).catch(() => {}) }}>
              <div className="flex justify-between items-start">
                <span className="font-medium">{u.nombre || u.nusuario || '—'}</span>
                <span className="text-xs text-blue-600">{t('proposed')}: {fmtDate(u.proposed_date_of_interview, lang)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {shortAddr(u.billetera)}
                {u.pais_nombre ? ` · ${u.pais_nombre}` : ''}
                {u.church_relationship ? ` · ${u.church_relationship}` : ''}
              </div>
            </div>
          ))}
        </div>}
      {selected && <UserEditModal lang={lang} t={t} user={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setRefresh(r => r + 1) }} />}
    </div>
  )
}

/* ── Recent Users Widget ── */

function RecentUsersWidget({ lang, t }: { lang: string; t: TFunc }) {
  const [items, setItems] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UserItem | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    fetch('/api/admin/users/recent')
      .then(r => r.json()).then(d => { setItems(d.users || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [refresh])

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">👤 {t('recentUsers')}</h2>
      {loading ? <p className="text-gray-500 text-sm">{t('loading')}</p>
        : items.length === 0 ? <p className="text-gray-500 text-sm">{t('noUsers')}</p>
        : <div className="space-y-1 max-h-64 overflow-y-auto">
          {items.map(u => (
            <div key={u.id} className="border-b border-gray-100 pb-2 text-sm cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-2"
              onClick={() => { fetch(`/api/admin/user/${u.id}`).then(r => r.json()).then(setSelected).catch(() => {}) }}>
              <div className="flex justify-between items-start">
                <span className="font-medium">{u.nombre || u.nusuario || '—'}</span>
                <span className="text-xs text-gray-400">{fmtDate(u.created_at, lang)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {shortAddr(u.billetera)}
                {u.pais_nombre ? ` · ${u.pais_nombre}` : ''}
                {u.profilescore != null ? ` · ${t('score')}: ${u.profilescore}` : ''}
                {u.church_relationship ? ` · ${u.church_relationship}` : ''}
              </div>
            </div>
          ))}
        </div>}
      {selected && <UserEditModal lang={lang} t={t} user={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setRefresh(r => r + 1) }} />}
    </div>
  )
}

/* ── User Edit Modal ── */

function UserEditModal({ lang, t, user, onClose, onSaved }: { lang: string; t: TFunc; user: UserItem; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const initial: Record<string, any> = {}
    // Verified fields: checked if the verified value matches the source value
    for (const f of VERIFIED_FIELDS) {
      if (f.source) {
        initial[f.key] = !!(user as any)[f.key] && String((user as any)[f.key]) === String((user as any)[f.source])
      } else {
        // verified_church_relationship is a string value (pastor/leader/member)
        initial[f.key] = (user as any)[f.key] || ''
      }
    }
    initial.nombre = user.nombre || ''
    initial.email = user.email || ''
    initial.whatsapp = user.whatsapp || ''
    initial.telegram = user.telegram || ''
    initial.passport_name = user.passport_name || ''
    initial.passport_nationality = user.passport_nationality || ''
    initial.proposed_date_of_interview = user.proposed_date_of_interview || ''
    initial.conducted_date_of_interview = user.conducted_date_of_interview || ''
    setForm(initial)
  }, [user])

  const toggle = (key: string, source?: string) => setForm(f => {
    const next = !f[key]
    if (source) {
      // When checking: copy source value to verified field. When unchecking: clear it.
      return { ...f, [key]: next ? (user as any)[source] : '' }
    }
    return { ...f, [key]: next }
  })
  const setF = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    const body: Record<string, any> = {}
    // Profile fields
    for (const k of ['nombre', 'email', 'whatsapp', 'telegram', 'passport_name', 'passport_nationality',
      'proposed_date_of_interview', 'conducted_date_of_interview']) {
      if (form[k] !== undefined) body[k] = form[k] || null
    }
    // Verified fields: send the copied value (or empty to clear)
    for (const f of VERIFIED_FIELDS) {
      body[f.key] = form[f.key] || null
    }
    const res = await fetch(`/api/admin/user/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) { setMsg(t('saveSuccess')); setTimeout(onSaved, 800) }
    else setMsg('Error')
  }

  return (
    <Modal title={`${t('editUser')}: ${user.nombre || user.nusuario || user.id}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Profile fields */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('profileFields')}</h4>
          <div className="grid grid-cols-2 gap-2">
            <InputField label={t('name')} value={form.nombre} onChange={v => setF('nombre', v)} />
            <InputField label="Email" value={form.email} onChange={v => setF('email', v)} />
            <InputField label="WhatsApp" value={form.whatsapp} onChange={v => setF('whatsapp', v)} />
            <InputField label="Telegram" value={form.telegram} onChange={v => setF('telegram', v)} />
            <InputField label={lang === 'es' ? 'Nombre Pasaporte' : 'Passport Name'} value={form.passport_name} onChange={v => setF('passport_name', v)} />
            <InputField label={lang === 'es' ? 'Nacionalidad Pasaporte' : 'Passport Nationality'} value={form.passport_nationality} onChange={v => setF('passport_nationality', v)} />
          </div>
        </div>

        {/* Interview dates */}
        <div className="grid grid-cols-2 gap-2">
          <InputField label={lang === 'es' ? 'Entrevista Propuesta' : 'Proposed Interview'} value={form.proposed_date_of_interview || ''} onChange={v => setF('proposed_date_of_interview', v)} type="date" />
          <InputField label={lang === 'es' ? 'Entrevista Realizada' : 'Conducted Interview'} value={form.conducted_date_of_interview || ''} onChange={v => setF('conducted_date_of_interview', v)} type="date" />
        </div>

        {/* Verified fields */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('verifiedFields')}</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {VERIFIED_FIELDS.map(f => (
              f.source ? (
                <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                  <input type="checkbox" checked={!!form[f.key]} onChange={() => toggle(f.key, f.source || undefined)} className="rounded" />
                  <span>{lang === 'es' ? f.labelEs : f.labelEn}</span>
                  {form[f.key] ? <span className="text-xs text-green-600 ml-auto">{String(form[f.key]).slice(0, 20)}</span> : null}
                </label>
              ) : (
                <div key={f.key} className="text-sm px-2 py-1">
                  <span className="text-xs text-gray-500">{lang === 'es' ? f.labelEs : f.labelEn}</span>
                  <input type="text" value={form[f.key] || ''} onChange={e => setF(f.key, e.target.value)}
                    className="w-full border rounded px-2 py-0.5 text-sm mt-0.5" placeholder="pastor / leader / member" />
                </div>
              )
            ))}
          </div>
        </div>

        {msg && <p className={`text-sm text-center ${msg === t('saveSuccess') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">{t('cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? (lang === 'es' ? 'Guardando...' : 'Saving...') : t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function InputField({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
    </div>
  )
}

/* ── Recent Churches Widget ── */

interface ChurchItem {
  id: number; name?: string; pastor_name?: string; pastor_whatsapp?: string
  pastor_telegram?: string; city_name?: string; denomination?: string
  country_name?: string; registration?: string; registration_verified?: boolean
  created_at?: string
}

function RecentChurchesWidget({ lang, t }: { lang: string; t: TFunc }) {
  const [items, setItems] = useState<ChurchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ChurchItem | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    fetch('/api/admin/churches/recent')
      .then(r => r.json()).then(d => { setItems(d.churches || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [refresh])

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">🏛️ {t('recentChurches')}</h2>
      {loading ? <p className="text-gray-500 text-sm">{t('loading')}</p>
        : items.length === 0 ? <p className="text-gray-500 text-sm">{t('noChurches')}</p>
        : <div className="space-y-1 max-h-64 overflow-y-auto">
          {items.map(ch => (
            <div key={ch.id} className="border-b border-gray-100 pb-2 text-sm cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-2"
              onClick={() => { fetch(`/api/admin/church/${ch.id}`).then(r => r.json()).then(setSelected).catch(() => {}) }}>
              <div className="flex justify-between items-start">
                <span className="font-medium">{ch.name || '—'}</span>
                <span className="text-xs text-gray-400">{fmtDate(ch.created_at, lang)}</span>
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
      {selected && <ChurchEditModal lang={lang} t={t} church={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setRefresh(r => r + 1) }} />}
    </div>
  )
}

/* ── Church Edit Modal ── */

function ChurchEditModal({ lang, t, church, onClose, onSaved }: { lang: string; t: TFunc; church: ChurchItem; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setForm({
      name: church.name || '',
      pastor_name: church.pastor_name || '',
      pastor_whatsapp: church.pastor_whatsapp || '',
      pastor_telegram: church.pastor_telegram || '',
      city_name: church.city_name || '',
      denomination: church.denomination || '',
      registration: church.registration || '',
      registration_verified: !!church.registration_verified,
    })
  }, [church])

  const setF = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch(`/api/admin/church/${church.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { setMsg(t('saveSuccess')); setTimeout(onSaved, 800) }
    else setMsg('Error')
  }

  const handleDelete = async () => {
    if (!confirm(t('deleteConfirm'))) return
    setDeleting(true)
    const res = await fetch(`/api/admin/church/${church.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) onSaved()
    else setMsg('Error')
  }

  return (
    <Modal title={`${t('editChurch')}: ${church.name || church.id}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <InputField label={t('name')} value={form.name} onChange={v => setF('name', v)} />
          <InputField label={t('city')} value={form.city_name} onChange={v => setF('city_name', v)} />
          <InputField label={t('pastor')} value={form.pastor_name} onChange={v => setF('pastor_name', v)} />
          <InputField label="WhatsApp" value={form.pastor_whatsapp} onChange={v => setF('pastor_whatsapp', v)} />
          <InputField label="Telegram" value={form.pastor_telegram} onChange={v => setF('pastor_telegram', v)} />
          <InputField label={t('denomination')} value={form.denomination} onChange={v => setF('denomination', v)} />
          <InputField label={lang === 'es' ? 'Registro' : 'Registration'} value={form.registration} onChange={v => setF('registration', v)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.registration_verified} onChange={e => setF('registration_verified', e.target.checked)} className="rounded" />
          <span>{lang === 'es' ? 'Registro Verificado' : 'Registration Verified'}</span>
        </label>

        {msg && <p className={`text-sm text-center ${msg === t('saveSuccess') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}

        <div className="flex justify-between">
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">
            {deleting ? (lang === 'es' ? 'Eliminando...' : 'Deleting...') : t('delete')}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">{t('cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? (lang === 'es' ? 'Guardando...' : 'Saving...') : t('save')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
