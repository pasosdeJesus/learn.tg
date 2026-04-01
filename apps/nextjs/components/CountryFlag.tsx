'use client'

interface CountryFlagProps {
  alfa2: string | null
  className?: string
  showTooltip?: boolean
}

/**
 * Converts ISO 3166-1 alpha-2 country code to flag emoji
 * Example: "US" → "🇺🇸", "CO" → "🇨🇴"
 */
function countryCodeToFlagEmoji(alfa2: string): string {
  if (!alfa2 || alfa2.length !== 2) return '🏳️'

  const codePoints = alfa2
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0)) // Regional Indicator Symbol Letter A = 127462, 'A' = 65 -> 127462 - 65 = 127397
  return String.fromCodePoint(...codePoints)
}

export function CountryFlag({ alfa2, className = '', showTooltip = true }: CountryFlagProps) {
  if (!alfa2) {
    return (
      <span className={className} title="No country">
        🏳️
      </span>
    )
  }

  const flagEmoji = countryCodeToFlagEmoji(alfa2)
  const title = showTooltip ? `Country: ${alfa2}` : undefined

  return (
    <span className={className} title={title} role="img" aria-label={`Flag of ${alfa2}`}>
      {flagEmoji}
    </span>
  )
}

export default CountryFlag