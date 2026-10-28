// Premium course pricing logic (https://github.com/pasosdeJesus/learn.tg/issues/128)
// Pure functions so they are unit-testable without DB or on-chain access.

export const DEFAULT_SLEARN_RATE = 22
export const SLEARN_DISCOUNT = 0.1 // 10% discount for paying in SLEARN

// Linear price formula p = A * hdi + B, calibrated from two points
// (operator decision, 2026-10-28):
//   Sierra Leone:  hdi = 0.467 → 0.50 USDT (poorest pilot country)
//   United States: hdi = 0.938 → 3.00 USDT (richest buyer we expect)
// Colombia (hdi 0.788) falls in between at 2.20 USDT; it is no longer an anchor,
// so moving either end moves Colombia too.
const SIERRA_LEONE_HDI = 0.467
const SIERRA_LEONE_PRICE = 0.5
const UNITED_STATES_HDI = 0.938
const UNITED_STATES_PRICE = 3

const PRICE_A = (UNITED_STATES_PRICE - SIERRA_LEONE_PRICE) / (UNITED_STATES_HDI - SIERRA_LEONE_HDI)
const PRICE_B = SIERRA_LEONE_PRICE - PRICE_A * SIERRA_LEONE_HDI

/**
 * USDT price from a country's HDI using the two-point linear calibration.
 * There is no ceiling: a country with a higher HDI than the United States pays
 * more than 3 USDT (operator decision, 2026-10-28).
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
