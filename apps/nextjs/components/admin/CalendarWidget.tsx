'use client'

import { useEffect, useState } from 'react'
import { Modal } from './Modal'

interface CalEvent { uid: string; start: string; end: string; summary?: string }

type TFunc = (k: string) => string

export function CalendarWidget({ lang, t }: { lang: string; t: TFunc }) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showBlock, setShowBlock] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchEvents = () => {
    setLoading(true)
    fetch('/api/admin/calendar/events')
      .then(r => r.json())
      .then(d => {
        const now = new Date()
        const upcoming = (d.events || [])
          .filter((e: CalEvent) => new Date(e.end) >= now)
          .slice(0, 10)
        setEvents(upcoming)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }
  useEffect(fetchEvents, [])

  const handleDelete = async (uid: string) => {
    setDeleting(uid)
    await fetch(`/api/admin/calendar/block?uid=${encodeURIComponent(uid)}`, { method: 'DELETE' })
    setDeleting(null)
    fetchEvents()
  }

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
        : <div className="space-y-1 max-h-80 overflow-y-auto">
          {events.map((e, i) => (
            <div key={e.uid || i} className="flex items-center gap-2 text-sm py-1 border-b border-gray-100 last:border-0 group">
              <span className="text-xs text-gray-500 w-20 shrink-0">{formatDate(e.start)}</span>
              <span className="text-xs font-medium w-16 shrink-0">{formatTime(e.start)}</span>
              <span className={`flex-1 text-xs ${e.summary?.toLowerCase().includes('block') ? 'text-red-600' : 'text-green-700'}`}>
                {e.summary || t('blocked')}
              </span>
              <button
                onClick={() => handleDelete(e.uid)}
                disabled={deleting === e.uid}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-1"
                title={lang === 'es' ? 'Eliminar' : 'Delete'}
              >
                {deleting === e.uid ? '...' : '✕'}
              </button>
            </div>
          ))}
        </div>}
    </div>
  )
}

export function BlockTimeDialog({ lang, t, onClose, onSaved }: { lang: string; t: TFunc; onClose: () => void; onSaved: () => void }) {
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
