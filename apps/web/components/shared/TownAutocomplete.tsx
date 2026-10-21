'use client'

import { useState, useRef, useEffect } from 'react'

interface TownSuggestion { id: number; town: string; municipio_id: number; municipio: string; departamento_id: number; departamento: string }

interface TownAutocompleteProps {
  value: string        // display text (city/town name)
  cityId: number | null
  countryId: number | null
  lang?: string
  placeholder?: string
  onChange: (cityId: number | null, cityName: string, departmentId?: number, municipalityId?: number) => void
}

export function TownAutocomplete({ value, cityId, countryId, lang, placeholder, onChange }: TownAutocompleteProps) {
  const [search, setSearch] = useState(value || '')
  const [suggestions, setSuggestions] = useState<TownSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Sync external value when cityId changes from parent
  useEffect(() => {
    if (value && !search) setSearch(value)
  }, [value])

  const handleSearch = (q: string) => {
    setSearch(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!countryId || q.length < 2) { setSuggestions([]); return }

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/towns/search?country=${countryId}&q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setSuggestions(data.towns || data || [])
      } catch { setSuggestions([]) }
      setLoading(false)
    }, 300)
  }

  const handleSelect = (s: TownSuggestion) => {
    setSearch(`${s.town}, ${s.municipio}, ${s.departamento}`)
    setSuggestions([])
    onChange(s.id, s.town, s.departamento_id, s.municipio_id)
  }

  const handleBlur = () => {
    setTimeout(() => setSuggestions([]), 200)
    if (!cityId && search && suggestions.length === 0) {
      // Free text entry
      onChange(null, search)
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={e => handleSearch(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder || (lang === 'es' ? 'Población...' : 'Town...')}
        className="w-full border rounded px-2 py-1 text-sm"
      />
      {loading && <span className="absolute right-2 top-1.5 text-xs text-gray-400">...</span>}
      {suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
          {suggestions.map(s => (
            <li key={s.id} className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer text-xs"
              onMouseDown={() => handleSelect(s)}>
              {s.town}, {s.municipio}, {s.departamento}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
