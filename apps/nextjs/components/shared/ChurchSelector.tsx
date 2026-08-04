'use client'

import { useEffect, useState } from 'react'

interface Church { id: number; name: string; city_name?: string }

interface ChurchSelectorProps {
  value: number | null           // selected church ID
  countryId: number | null
  cityId: number | null
  lang?: string
  onChange: (churchId: number | null, churchName: string) => void
  allowNew?: boolean             // show "+ New church" option
  onNewChurch?: () => void
  refreshKey?: number            // trigger re-fetch when changed
}

export function ChurchSelector({ value, countryId, cityId, lang, onChange, allowNew, onNewChurch, refreshKey }: ChurchSelectorProps) {
  const [churches, setChurches] = useState<Church[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!countryId) { setChurches([]); return }
    setLoading(true)
    const params = new URLSearchParams({ q: '', country: String(countryId) })
    if (cityId) params.set('cityId', String(cityId))
    // Auth params from localStorage
    const addr = typeof window !== 'undefined' ? localStorage.getItem('learn.tg.sessionAddress') || '' : ''
    const tok = typeof window !== 'undefined' ? localStorage.getItem('learn.tg.authToken') || '' : ''
    if (addr) params.set('walletAddress', addr)
    if (tok) params.set('token', tok)
    fetch(`/api/churches/search?${params}`)
      .then(r => {
        if (!r.ok) {
          console.log(`[ChurchSelector] HTTP ${r.status} — addr: ${addr.slice(0, 10)}..., tokenLen: ${tok.length}`)
        }
        return r.json()
      })
      .then(d => { setChurches(d.churches || d || []); setLoading(false) })
      .catch((e) => {
        console.log('[ChurchSelector] Error:', e?.message || String(e))
        setLoading(false)
      })
  }, [countryId, cityId, refreshKey])

  const handleChange = (val: string) => {
    if (val === '__new__') { onNewChurch?.(); return }
    const id = val ? Number(val) : null
    const ch = churches.find(c => c.id === id)
    onChange(id, ch?.name || '')
  }

  return (
    <select
      value={value?.toString() || ''}
      onChange={e => handleChange(e.target.value)}
      disabled={!countryId || loading}
      className="w-full border rounded px-2 py-1 text-sm"
    >
      <option value="">{loading ? '...' : '—'}</option>
      {churches.map(ch => (
        <option key={ch.id} value={ch.id}>
          {ch.name}{ch.city_name ? ` — ${ch.city_name}` : ''}
        </option>
      ))}
      {allowNew && <option value="__new__">{lang === 'es' ? '+ Nueva iglesia' : '+ New church'}</option>}
    </select>
  )
}
