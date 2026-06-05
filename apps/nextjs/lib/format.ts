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

export function formatLearningPoints(value: number): string {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function formatUSDT(value: number): string {
  return formatCurrency(value, 'USD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    displayCurrency: true,
  })
}

export function formatCELO(value: number): string {
  return formatCurrency(value, 'CELO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    displayCurrency: true,
  })
}

export function t(en: string, es: string, lang?: string): string {
  // Default to English for now
  // In production, lang would come from app/[lang]/...
  return lang === 'es' ? es : en
}