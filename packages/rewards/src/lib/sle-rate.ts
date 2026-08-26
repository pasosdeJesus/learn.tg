'use server'

/**
 * Current SLE/USD exchange rate.
 *
 * TODO: Replace with API call to stable-sl.pdJ.app when rate monitor is active.
 * The rate will be used to calculate SLEARN amounts from USDT donations.
 */
export async function getSLEUSDRate(): Promise<number> {
  // TODO: const response = await fetch('https://stable-sl.pdJ.app/api/rate')
  // TODO: return response.json().rate
  return 22
}
