'use client'

import { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CountryFlag } from '@/components/CountryFlag'
import { createComponentT } from '@/lib/hooks/useTranslation'

export interface Country {
  alfa2: string
  nombre: string
}

interface CountryFilterProps {
  countries: Country[]
  selectedCountry?: string | null
  onCountryChange: (country: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  lang?: string
}

export function CountryFilter({
  countries,
  selectedCountry,
  onCountryChange,
  placeholder = 'All countries',
  className = '',
  disabled = false,
  lang = 'en',
}: CountryFilterProps) {
  const t = useMemo(() => createComponentT(lang, {
    en: { allCountries: 'All countries', country: 'Country:' },
    es: { allCountries: 'Todos los países', country: 'País:' },
  }), [lang])

  // Translate default placeholder if not customized
  const translatedPlaceholder = placeholder === 'All countries'
    ? t('allCountries')
    : placeholder

  const handleValueChange = (value: string) => {
    onCountryChange(value === 'all' ? null : value)
  }

  const sortedCountries = [...countries].sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm text-muted-foreground">{t('country')}</span>
      <Select
        value={selectedCountry || 'all'}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={translatedPlaceholder}>
            {selectedCountry ? (
              <div className="flex items-center gap-2">
                <CountryFlag alfa2={selectedCountry} />
                <span>{countries.find(c => c.alfa2 === selectedCountry)?.nombre || selectedCountry}</span>
              </div>
            ) : (
              translatedPlaceholder
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <span className="w-4">🌍</span>
              <span>{t('allCountries')}</span>
            </div>
          </SelectItem>
          {sortedCountries.map(country => (
            <SelectItem key={country.alfa2} value={country.alfa2}>
              <div className="flex items-center gap-2">
                <CountryFlag alfa2={country.alfa2} />
                <span>{country.nombre}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}