'use client'

import { useEffect, useState } from 'react'
import { Modal, InputField } from './Modal'
import { CountrySelect, ReligionSelect, ChurchRoleSelect } from '@/components/shared/FormSelects'
import { TownAutocomplete } from '@/components/shared/TownAutocomplete'
import { ChurchSelector } from '@/components/shared/ChurchSelector'
import { PhotoUpload } from '@/components/shared/PhotoUpload'
import { adminFetch } from '@/lib/admin-fetch'
import { CalendarWidget } from './CalendarWidget'
import { VERIFIED_FIELDS_CONFIG } from '@/lib/score-rules'

type TFunc = (k: string) => string

/* ── Shared types ── */

export interface UserItem {
  id: number; nombre?: string; nusuario?: string; billetera?: string
  pais_nombre?: string; pais_id?: number | string; profilescore?: number
  church_relationship?: string; religion_id?: number | string; church_id?: number | string
  proposed_date_of_interview?: string; conducted_date_of_interview?: string
  created_at?: string; email?: string; whatsapp?: string; telegram?: string
  passport_name?: string; passport_nationality?: number | string
  city_id?: number; place_of_worship?: string; place_of_worship_location?: string
  pastor_name?: string; pastor_whatsapp?: string
  verified_whatsapp?: string; verified_telegram?: string; verified_email?: string
  verified_city_id?: number | string; verified_place_of_worship?: string
  verified_church_relationship?: string
}

export interface ChurchItem {
  id: number; name?: string; pastor_name?: string; pastor_whatsapp?: string
  pastor_telegram?: string; city_name?: string; denomination?: string
  country_name?: string; registration?: string; registration_photo?: string; registration_verified?: boolean
  created_at?: string
}

const VERIFIED_FIELDS = VERIFIED_FIELDS_CONFIG

function fmtDate(s?: string, lang?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString(lang === 'es' ? 'es' : 'en')
}

function shortAddr(a?: string) {
  if (!a) return ''
  return `${a.slice(0, 6)}...${a.slice(-4)}`
}

/* ── Pending Verifications Widget ── */

export function PendingWidget({ lang, t, onUserModalClose }: { lang: string; t: TFunc; onUserModalClose?: () => void }) {
  const [items, setItems] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UserItem | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    adminFetch('/api/admin/users?status=pending')
      .then(d => { setItems(d.users || []); setLoading(false) })
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
              onClick={() => { adminFetch(`/api/admin/user/${u.id}`).then(setSelected).catch(() => {}) }}>
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
      {selected && <UserEditModal lang={lang} t={t} user={selected} onClose={() => { setSelected(null); onUserModalClose?.() }} onSaved={() => { setSelected(null); setRefresh(r => r + 1); onUserModalClose?.() }} />}
    </div>
  )
}

/* ── Recent Users Widget ── */

export function RecentUsersWidget({ lang, t, onUserModalClose }: { lang: string; t: TFunc; onUserModalClose?: () => void }) {
  const [items, setItems] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UserItem | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    adminFetch('/api/admin/users/recent')
      .then(d => { setItems(d.users || []); setLoading(false) })
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
              onClick={() => { adminFetch(`/api/admin/user/${u.id}`).then(setSelected).catch(() => {}) }}>
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
      {selected && <UserEditModal lang={lang} t={t} user={selected} onClose={() => { setSelected(null); onUserModalClose?.() }} onSaved={() => { setSelected(null); setRefresh(r => r + 1); onUserModalClose?.() }} />}
    </div>
  )
}

/* ── Recent Churches Widget ── */

export function RecentChurchesWidget({ lang, t }: { lang: string; t: TFunc }) {
  const [items, setItems] = useState<ChurchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ChurchItem | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    adminFetch('/api/admin/churches/recent')
      .then(d => { setItems(d.churches || []); setLoading(false) })
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
              onClick={() => { adminFetch(`/api/admin/church/${ch.id}`).then(setSelected).catch(() => {}) }}>
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

/* ── User Edit Modal ── */

export function UserEditModal({ lang, t, user, onClose, onSaved }: { lang: string; t: TFunc; user: UserItem; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [creatingChurch, setCreatingChurch] = useState(false)
  const [churchRefresh, setChurchRefresh] = useState(0)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const initial: Record<string, any> = {}
    // Verified fields: store the actual DB value (number or string)
    for (const f of VERIFIED_FIELDS) {
      if (f.source) {
        const dbVal = (user as any)[f.key]
        if (typeof dbVal === 'number') {
          initial[f.key] = dbVal === 0 ? '' : String(dbVal)
        } else if (typeof dbVal === 'string' && dbVal !== 'true' && dbVal !== 'false') {
          initial[f.key] = dbVal
        } else {
          initial[f.key] = ''
        }
      } else {
        initial[f.key] = (user as any)[f.key] || ''
      }
    }
    initial.nombre = user.nombre || ''
    initial.email = user.email || ''
    initial.whatsapp = user.whatsapp || ''
    initial.telegram = user.telegram || ''
    initial.pais_id = user.pais_id || ''
    initial.religion_id = user.religion_id || ''
    initial.passport_name = user.passport_name || ''
    initial.passport_nationality = user.passport_nationality || ''
    initial.place_of_worship = user.place_of_worship || ''
    initial.place_of_worship_location = user.place_of_worship_location || ''
    initial.city_id = user.city_id || ''
    initial.pastor_name = user.pastor_name || ''
    initial.pastor_whatsapp = user.pastor_whatsapp || ''
    initial.church_relationship = user.church_relationship || ''
    initial.church_id = user.church_id || ''
    initial.proposed_date_of_interview = user.proposed_date_of_interview ? user.proposed_date_of_interview.slice(0, 16) : ''
    initial.conducted_date_of_interview = user.conducted_date_of_interview ? user.conducted_date_of_interview.slice(0, 16) : ''
    setForm(initial)
  }, [user])

  // Checkbox checked = verified value is a non-empty, non-boolean string
  const isChecked = (key: string) => {
    const v = form[key]
    if (v == null || v === '') return false
    if (typeof v === 'number') return v !== 0
    const s = String(v)
    return s.length > 0 && s !== 'true' && s !== 'false' && s !== '0'
  }

  const toggle = (key: string, source?: string) => setForm(f => {
    const currentlyChecked = isChecked(key)
    if (!source) return { ...f, [key]: currentlyChecked ? '' : 'checked' }

    let sourceVal = (f as any)[source]
    // If city_id is null (non-centro-poblado country), city checkbox toggles place_of_worship_location instead
    if (key === 'verified_city_id' && (sourceVal == null || sourceVal === '')) {
      // No centro poblado: delegate to place_of_worship_location verification
      const placeLoc = f.place_of_worship_location
      const newVal = currentlyChecked ? '' : String(placeLoc || '')
      return {
        ...f,
        verified_city_id: '',
        verified_place_of_worship_location: newVal,
      }
    }

    const newVal = currentlyChecked ? '' : String(sourceVal ?? '')
    const next: Record<string, any> = { ...f, [key]: newVal }

    return next
  })
  const setF = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    const body: Record<string, any> = {}
    for (const k of ['nombre', 'email', 'whatsapp', 'telegram', 'pais_id', 'religion_id',
      'passport_name', 'passport_nationality',
      'place_of_worship', 'place_of_worship_location', 'church_id', 'church_relationship',
      'city_id',
      'proposed_date_of_interview', 'conducted_date_of_interview']) {
      if (form[k] !== undefined) body[k] = form[k] || null
    }
    // Verified fields: send the value (string) or null
    for (const f of VERIFIED_FIELDS) {
      const v = form[f.key]
      if (f.source) {
        // Convert numeric IDs from string to number for DB compatibility.
        // If the value is text (non-SL country fallback), send as-is.
        const isNumericId = f.key === 'verified_city_id'
        body[f.key] = (typeof v === 'string' && v.length > 0 && v !== 'true' && v !== 'false')
          ? (isNumericId ? Number(v) : v)
          : null
      } else {
        body[f.key] = v || null
      }
    }
    try {
      const bodyJson = JSON.stringify(body)
      console.log('[UserEditModal] Saving:', { city_id: body.city_id, verified_city_id: body.verified_city_id, fullBody: bodyJson.slice(0, 200) })
      await adminFetch(`/api/admin/user/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: bodyJson })
      onSaved()
    } catch (e: any) {
      setMsg(e.message || 'Error')
    }
    setSaving(false)
  }

  return (
    <Modal title={`${t('editUser')}: ${user.nombre || user.nusuario || user.id}`} onClose={onClose}>
      <div className="space-y-4">
        {user.profilescore != null && (
          <p className="text-sm text-gray-600">{t('score')}: <span className="font-bold">{user.profilescore}</span></p>
        )}
        <p className="text-sm">
          <a href={`/${lang}/user/${user.id}`} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:underline">
            {lang === 'es' ? 'Ver perfil público' : 'View public profile'} →
          </a>
        </p>
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('profileFields')}</h4>
          <div className="grid grid-cols-2 gap-2">
            <InputField label={t('name')} value={form.nombre} onChange={v => setF('nombre', v)} />
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{lang === 'es' ? 'País' : 'Country'}</label>
              <CountrySelect value={form.pais_id || null} onChange={v => setF('pais_id', String(v || ''))} lang={lang} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{lang === 'es' ? 'Religión' : 'Religion'}</label>
              <ReligionSelect value={form.religion_id ? Number(form.religion_id) : null} onChange={v => setF('religion_id', String(v || ''))} lang={lang} />
            </div>
            <InputField label="Email" value={form.email} onChange={v => setF('email', v)} />
            <InputField label="WhatsApp" value={form.whatsapp} onChange={v => setF('whatsapp', v)} />
            <InputField label="Telegram" value={form.telegram} onChange={v => setF('telegram', v)} />
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{lang === 'es' ? 'Nombre Pasaporte' : 'Passport Name'}</label>
              <div className="flex items-center gap-2">
                <InputField label="" value={form.passport_name} onChange={v => setF('passport_name', v)} />
                <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0" title={lang === 'es' ? 'Copiar de Nombre' : 'Copy from Name'}>
                  <input type="checkbox" checked={form.passport_name === form.nombre && !!form.nombre}
                    onChange={() => setF('passport_name', form.passport_name === form.nombre ? '' : (form.nombre || ''))} className="rounded" />
                  <span className="text-gray-400">= {t('name')}</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{lang === 'es' ? 'Nacionalidad Pasaporte' : 'Passport Nationality'}</label>
              <div className="flex items-center gap-2">
                <CountrySelect value={form.passport_nationality || null} onChange={v => setF('passport_nationality', String(v || ''))} lang={lang} />
                <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0" title={lang === 'es' ? 'Copiar de País' : 'Copy from Country'}>
                  <input type="checkbox" checked={String(form.passport_nationality || '') === String(form.pais_id || '') && !!form.pais_id}
                    onChange={() => setF('passport_nationality', String(form.passport_nationality || '') === String(form.pais_id || '') ? '' : String(form.pais_id || ''))} className="rounded" />
                  <span className="text-gray-400">= {lang === 'es' ? 'País' : 'Country'}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{lang === 'es' ? 'Ciudad del Lugar de Culto' : 'City of Place of Worship'}</label>
          <TownAutocomplete
            value={form.place_of_worship_location || ''}
            cityId={form.city_id ? Number(form.city_id) : null}
            countryId={form.pais_id ? Number(form.pais_id) : null}
            lang={lang}
            onChange={(cityId, cityName) => {
              setF('place_of_worship_location', cityName)
              setF('city_id', cityId != null ? String(cityId) : '')
              if (isChecked('verified_place_of_worship')) setF('verified_place_of_worship', '')
            }}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{lang === 'es' ? 'Lugar de Culto' : 'Place of Worship'}</label>
          <input type="text" value={form.place_of_worship || ''} onChange={e => setF('place_of_worship', e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm text-gray-900 bg-white"
            placeholder={lang === 'es' ? 'Nombre de iglesia/mezquita...' : 'Church/mosque name...'} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{lang === 'es' ? 'Asignar Iglesia' : 'Assign Church'}</label>
          <ChurchSelector
            value={form.church_id ? Number(form.church_id) : null}
            countryId={form.pais_id ? Number(form.pais_id) : null}
            cityId={null}
            lang={lang}
            refreshKey={churchRefresh}
            onChange={async (id, name) => {
              setF('church_id', String(id || ''))
              if (name) setF('place_of_worship', name)
              // Auto-fill pastor info from church
              if (id) {
                try {
                  const church = await adminFetch(`/api/admin/church/${id}`)
                  if (church.pastor_name) setF('pastor_name', church.pastor_name)
                  if (church.pastor_whatsapp) setF('pastor_whatsapp', church.pastor_whatsapp)
                } catch {}
              }
            }}
          />
        </div>
        {(() => {
          const hasPastorInfo = (form.pastor_name || form.pastor_whatsapp) && !form.church_id
          const hasChurchName = form.place_of_worship
          const countryId = form.pais_id ? Number(form.pais_id) : null
          if (!hasPastorInfo || !hasChurchName || !countryId) return null
          return (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-xs text-gray-700 mb-2">
                {lang === 'es'
                  ? 'El usuario suministró esta información de iglesia. ¿Crearla?'
                  : 'User supplied this church info. Create it?'}
              </p>
              <div className="text-xs text-gray-600 space-y-0.5 mb-2">
                <p><strong>{lang === 'es' ? 'Iglesia' : 'Church'}:</strong> {form.place_of_worship}</p>
                {form.place_of_worship_location && <p><strong>{lang === 'es' ? 'Ciudad' : 'City'}:</strong> {form.place_of_worship_location}</p>}
                {form.pastor_name && <p><strong>{t('pastor')}:</strong> {form.pastor_name}</p>}
                {form.pastor_whatsapp && <p><strong>WhatsApp:</strong> {form.pastor_whatsapp}</p>}
              </div>
              <button
                type="button"
                disabled={creatingChurch}
                onClick={async () => {
                  setCreatingChurch(true)
                  try {
                    const data = await adminFetch('/api/admin/churches', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: form.place_of_worship,
                        pastor_name: form.pastor_name,
                        pastor_whatsapp: form.pastor_whatsapp,
                        country_id: countryId,
                        city_name: form.place_of_worship_location || null,
                      }),
                    })
                    const church = data.church
                    setF('church_id', String(church.id))
                    setF('place_of_worship', church.name)
                    setChurchRefresh(r => r + 1)
                    setMsg(lang === 'es' ? 'Iglesia creada y asignada' : 'Church created & assigned')
                  } catch (e: any) {
                    const msg = e.message || String(e)
                    if (msg.includes('401') || msg.includes('403')) {
                      setMsg(lang === 'es'
                        ? 'Error de autenticación. Intenta desconectar y reconectar tu billetera.'
                        : 'Auth error. Try disconnecting and reconnecting your wallet.')
                    } else {
                      setMsg(msg || 'Error')
                    }
                  }
                  setCreatingChurch(false)
                }}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {creatingChurch
                  ? (lang === 'es' ? 'Creando...' : 'Creating...')
                  : (lang === 'es' ? 'Crear Iglesia' : 'Create Church')}
              </button>
            </div>
          )
        })()}
        <div className="grid grid-cols-2 gap-2">
          <InputField label={lang === 'es' ? 'Entrevista Propuesta' : 'Proposed Interview'} value={form.proposed_date_of_interview || ''} onChange={v => setF('proposed_date_of_interview', v)} type="datetime-local" />
          <InputField label={lang === 'es' ? 'Entrevista Realizada' : 'Conducted Interview'} value={form.conducted_date_of_interview || ''} onChange={v => setF('conducted_date_of_interview', v)} type="datetime-local" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">{lang === 'es' ? 'Rol en Iglesia' : 'Church Role'}</label>
          <ChurchRoleSelect value={form.church_relationship || null} onChange={v => setF('church_relationship', v || '')} lang={lang} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('verifiedFields')}</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {VERIFIED_FIELDS.map(f => {
              // Location fields: show only the relevant set per country type
              const isLocationField = f.key === 'verified_city_id'
              const isWorshipLoc = f.key === 'verified_place_of_worship_location'
              const hasCentroPoblado = form.city_id && String(form.city_id) !== ''
              if (isLocationField && !hasCentroPoblado) return null
              if (isWorshipLoc && hasCentroPoblado) return null
              if (!f.source) return null

              return (
                <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                  <input type="checkbox" checked={isChecked(f.key)} onChange={() => toggle(f.key, f.source || undefined)} className="rounded" />
                  <span>{lang === 'es' ? f.labelEs : f.labelEn}</span>
                  {isChecked(f.key) ? <span className="text-xs text-green-600 ml-auto">{String(form[f.key] || '').slice(0, 20)}</span> : null}
                </label>
              )
            })}
          </div>
        </div>
        <div className="border-t pt-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{lang === 'es' ? 'Documentos de Identidad' : 'ID Documents'}</h4>
          <div className="space-y-2">
            <PhotoUpload
              label={lang === 'es' ? 'Foto Frontal' : 'Front Photo'}
              existingPath={(user as any).id_photo_front || null}
              userId={user.id}
              walletAddress={user.billetera || ''}
              side="front"
              lang={lang}
            />
            <PhotoUpload
              label={lang === 'es' ? 'Foto Reverso' : 'Back Photo'}
              existingPath={(user as any).id_photo_back || null}
              userId={user.id}
              walletAddress={user.billetera || ''}
              side="back"
              lang={lang}
            />
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

/* ── Church Edit Modal ── */

export function ChurchEditModal({ lang, t, church, onClose, onSaved }: { lang: string; t: TFunc; church: ChurchItem; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [members, setMembers] = useState<{ id: number; nombre: string }[]>([])

  useEffect(() => {
    setForm({
      name: church.name || '', pastor_name: church.pastor_name || '', pastor_whatsapp: church.pastor_whatsapp || '',
      pastor_telegram: church.pastor_telegram || '', city_name: church.city_name || '', denomination: church.denomination || '',
      registration: church.registration || '', registration_photo: church.registration_photo || '', registration_verified: !!church.registration_verified,
    })
    // Fetch church members
    adminFetch(`/api/admin/users?church_id=${church.id}`)
      .then(d => {
        const list = d.users || []
        setMembers(list.slice(0, 10))
        setMemberCount(list.length)
      })
      .catch(() => { setMemberCount(null); setMembers([]) })
  }, [church])

  const setF = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminFetch(`/api/admin/church/${church.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      setMsg(t('saveSuccess'))
      setTimeout(onSaved, 800)
    } catch (e: any) {
      setMsg(e.message || 'Error')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm(t('deleteConfirm'))) return
    setDeleting(true)
    try {
      await adminFetch(`/api/admin/church/${church.id}`, { method: 'DELETE' })
      onSaved()
    } catch (e: any) {
      setMsg(e.message || 'Error')
    }
    setDeleting(false)
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">{lang === 'es' ? 'Documento de Registro' : 'Registration Document'}</label>
          {form.registration_photo ? (
            <p className="text-xs text-green-600 mb-1">✅ {lang === 'es' ? 'Documento subido' : 'Document uploaded'}</p>
          ) : (
            <p className="text-xs text-gray-400 mb-1">{lang === 'es' ? 'Sin documento' : 'No document'}</p>
          )}
          <input type="file" accept="image/*,.pdf" onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const fd = new FormData()
            fd.append('photo', file)
            const res = await adminFetch(`/api/admin/church/${church.id}/registration-photo`, { method: 'POST', body: fd })
            if (res.ok) setMsg(t('saveSuccess'))
            else setMsg('Error uploading document')
          }} className="text-xs" />
        </div>
        {memberCount !== null && memberCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            <p className="font-medium text-amber-800 mb-1">
              {lang === 'es'
                ? `${memberCount} miembro(s) en esta iglesia:`
                : `${memberCount} member(s) in this church:`}
            </p>
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {members.map(m => (
                <span key={m.id} className="block">
                  {m.nombre || `User #${m.id}`}
                </span>
              ))}
            </div>
          </div>
        )}
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
