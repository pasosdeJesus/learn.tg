/**
 * Precio USD de tokens de campaña (REQ/223 §4.1): los tokens pegados
 * (USDT/USDC ≈ 1 USD) no consultan API; el resto se cotiza por CoinGecko
 * (`coingeckoId`) con caché TTL (5 min) y caída ante fallos de red.
 */

export interface PriceableToken {
  key: string
  peggedUsd?: boolean
  coingeckoId?: string
}

const PRICE_TTL = 5 * 60 * 1000
const priceCache = new Map<string, { usd: number; at: number }>()

export function clearPriceCache() {
  priceCache.clear()
}

export async function getTokenUsdPrice(token: PriceableToken): Promise<number> {
  if (token.peggedUsd) return 1
  const id = token.coingeckoId || token.key
  const cached = priceCache.get(id)
  if (cached && Date.now() - cached.at < PRICE_TTL) return cached.usd
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Price fetch failed (${res.status}) for ${id}`)
  const json = (await res.json()) as Record<string, { usd?: number }>
  const usd = json[id]?.usd
  if (usd == null || Number.isNaN(usd)) throw new Error(`No USD price for ${id}`)
  priceCache.set(id, { usd, at: Date.now() })
  return usd
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100
}
