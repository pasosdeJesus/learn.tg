// Premium course pricing logic (REQ #128)
// Pure functions so they are unit-testable without DB or on-chain access.

export const DEFAULT_SLEARN_RATE = 22
export const SLEARN_DISCOUNT = 0.1 // 10% discount for paying in SLEARN

// Linear price formula p = A * hdi + B, calibrated from two points:
//   Sierra Leone: hdi = 0.467 → price = 2 USDT
//   Colombia:     hdi = 0.788 → price = 5 USDT
const PRICE_A = (5 - 2) / (0.788 - 0.467)
const PRICE_B = 2 - PRICE_A * 0.467

/**
 * USDT price from a country's HDI using the two-point linear calibration.
 */
export function calculatePremiumPriceUsdt(hdi: number): number {
  const raw = PRICE_A * hdi + PRICE_B
  return Math.round(raw * 100) / 100
}

/**
 * Convert a USDT price to SLEARN, applying the SLEARN payment discount.
 * priceSLEARN = priceUSDT * rate * (1 - SLEARN_DISCOUNT).
 */
export function calculatePremiumPriceSlearn(
  priceUsdt: number,
  rate: number,
): number {
  return Math.round(priceUsdt * rate * (1 - SLEARN_DISCOUNT) * 100) / 100
}
