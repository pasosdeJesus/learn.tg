'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CountryFlag } from '@/components/CountryFlag'

export interface Country {
  alfa2: string
  nombre: string
}

interface CountryFilterProps {
  countries: Country[]
  selectedCountry?: string | null // alfa2 or null/undefined for "all"
  onCountryChange: (country: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CountryFilter({
  countries,
  selectedCountry,
  onCountryChange,
  placeholder = 'All countries',
  className = '',
  disabled = false,
}: CountryFilterProps) {
  const handleValueChange = (value: string) => {
    // value will be 'all' for "all countries" or alfa2 code
    onCountryChange(value === 'all' ? null : value)
  }

  // Sort countries by name
  const sortedCountries = [...countries].sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm text-muted-foreground">Country:</span>
      <Select
        value={selectedCountry || 'all'}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={placeholder}>
            {selectedCountry ? (
              <div className="flex items-center gap-2">
                <CountryFlag alfa2={selectedCountry} />
                <span>{countries.find(c => c.alfa2 === selectedCountry)?.nombre || selectedCountry}</span>
              </div>
            ) : (
              placeholder
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <span className="w-4">🌍</span>
              <span>All countries</span>
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

export default CountryFilter