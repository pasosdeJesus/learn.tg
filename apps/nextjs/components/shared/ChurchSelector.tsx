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
  const [hint, setHint] = useState('')

  useEffect(() => {
    if (!countryId) { setChurches([]); setHint(''); return }
    setLoading(true)
    setHint('')
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
      .then(d => {
        const list: Church[] = Array.isArray(d.churches) ? d.churches : Array.isArray(d) ? d : []
        if (list.length === 0) {
          // 401/empty list: the API token is stale (rotated by a newer login)
          setHint(lang === 'es'
            ? 'La sesión expiró. Desconecta y reconecta tu billetera para ver las iglesias.'
            : 'Session expired. Disconnect and reconnect your wallet to see churches.')
        }
        setChurches(list)
        setLoading(false)
      })
      .catch((e) => {
        console.log('[ChurchSelector] Error:', e?.message || String(e))
        setHint(lang === 'es'
          ? 'No se pudieron cargar las iglesias.'
          : 'Could not load churches.')
        setLoading(false)
      })
  }, [countryId, cityId, refreshKey, lang])

  // Never hide the currently assigned church, even if it falls outside the
  // country/city filter or the list failed to load.
  const options = churches.some(ch => ch.id === value)
    ? churches
    : value != null
      ? [{ id: value, name: '', city_name: undefined }, ...churches]
      : churches

  const handleChange = (val: string) => {
    if (val === '__new__') { onNewChurch?.(); return }
    const id = val ? Number(val) : null
    const ch = options.find(c => c.id === id)
    onChange(id, ch?.name || '')
  }

  return (
    <div>
      <select
        value={value?.toString() || ''}
        onChange={e => handleChange(e.target.value)}
        disabled={!countryId || loading}
        className="w-full border rounded px-2 py-1 text-sm"
      >
        <option value="">{loading ? '...' : '—'}</option>
        {options.map(ch => (
          <option key={ch.id} value={ch.id}>
            {ch.name || `#${ch.id}`}{ch.city_name ? ` — ${ch.city_name}` : ''}
          </option>
        ))}
        {allowNew && <option value="__new__">{lang === 'es' ? '+ Nueva iglesia' : '+ New church'}</option>}
      </select>
      {hint && <p className="text-xs text-amber-600 mt-1">{hint}</p>}
    </div>
  )
}
