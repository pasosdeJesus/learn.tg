'use client'

import { useEffect, useState } from 'react'

interface Option { id: number; nombre?: string; name?: string; nombreiso_ingles?: string; name_english?: string }

export function CountrySelect({ value, onChange, lang }: {
  value: number | string | null
  onChange: (id: number | null) => void
  lang?: string
}) {
  const [countries, setCountries] = useState<Option[]>([])
  useEffect(() => {
    fetch('/api/countries').then(r => r.json()).then(setCountries).catch(() => {})
  }, [])

  return (
    <select
      value={value?.toString() || ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full border rounded px-2 py-1 text-sm text-gray-900 bg-white"
    >
      <option value="">—</option>
      {countries.map(c => (
        <option key={c.id} value={c.id}>
          {lang === 'en' && (c.name_english || c.nombreiso_ingles) ? (c.name_english || c.nombreiso_ingles) : (c.name || c.nombre)}
        </option>
      ))}
    </select>
  )
}

export function ReligionSelect({ value, onChange, lang }: {
  value: number | null
  onChange: (id: number | null) => void
  lang?: string
}) {
  const [religions, setReligions] = useState<Option[]>([])
  useEffect(() => {
    fetch('/api/religions').then(r => r.json()).then(setReligions).catch(() => {})
  }, [])

  return (
    <select
      value={value?.toString() || ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full border rounded px-2 py-1 text-sm text-gray-900 bg-white"
    >
      <option value="">—</option>
      {religions.map(r => (
        <option key={r.id} value={r.id}>
          {lang === 'en' && (r.name_english || r.nombreiso_ingles) ? (r.name_english || r.nombreiso_ingles) : (r.name || r.nombre)}
        </option>
      ))}
    </select>
  )
}

export function ChurchRoleSelect({ value, onChange, lang }: {
  value: string | null
  onChange: (role: string | null) => void
  lang?: string
}) {
  const isEs = lang === 'es'
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className="w-full border rounded px-2 py-1 text-sm text-gray-900 bg-white"
    >
      <option value="">—</option>
      <option value="pastor">{isEs ? 'Pastor' : 'Pastor'}</option>
      <option value="leader">{isEs ? 'Líder' : 'Leader'}</option>
      <option value="member">{isEs ? 'Miembro' : 'Member'}</option>
    </select>
  )
}
