/**
 * Format a number with thousand separators and decimal places
 * Example: 1234567.89 → "1,234,567.89"
 */
export function formatNumber(
  value: number,
  options?: {
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    locale?: string
  }
): string {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    locale = 'en-US',
  } = options || {}

  return value.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  })
}

/**
 * Format a currency amount
 * Example: 1234.56 → "$1,234.56"
 */
export function formatCurrency(
  value: number,
  currency: 'USD' | 'CELO' = 'USD',
  options?: {
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    locale?: string
    displayCurrency?: boolean
  }
): string {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    locale = 'en-US',
    displayCurrency = true,
  } = options || {}

  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
    style: displayCurrency ? 'currency' : 'decimal',
    currency: currency === 'USD' ? 'USD' : 'USD', // CELO doesn't have a currency code, use USD style
  })

  // Replace USD symbol with CELO if needed
  if (currency === 'CELO' && displayCurrency) {
    return formatted.replace('US$', 'CELO ').replace('$', 'CELO ')
  }

  return formatted
}

/**
 * Format learning points (no currency symbol)
 */
export function formatLearningPoints(value: number): string {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Format USDT amount for scholarship and donations
 */
export function formatUSDT(value: number): string {
  return formatCurrency(value, 'USD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    displayCurrency: true,
  })
}

/**
 * Format CELO amount for UBI
 */
export function formatCELO(value: number): string {
  return formatCurrency(value, 'CELO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    displayCurrency: true,
  })
}

/**
 * Simple translation function (placeholder for i18n)
 * In a real implementation, this would use a proper i18n library
 */
export function t(en: string, es: string, lang?: string): string {
  // Default to English for now
  // In production, lang would come from app/[lang]/...
  return lang === 'es' ? es : en
}