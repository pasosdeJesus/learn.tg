/**
 * Historial de movimientos de la billetera de una campaña (REQ/223 —
 * transparencia): lee transacciones y token-transfers de los explorers
 * públicos (Blockscout) de Celo y Base (Avalanche, cuando el explorer
 * responda). Etiqueta contrapartes contrato con su nombre (p. ej. piscinas
 * Uniswap) para distinguir "se retiró" de "se invirtió" (pools / XAUt0).
 *
 * Sin secretos, datos públicos de la billetera destino.
 */

import { getCampaignConfig } from '../lib/donation-target'

const TTL = 60_000
const cache = new Map<string, { at: number; value: any }>()

const MAINNET_EXPLORERS = [
  { chain: 'celo', base: 'https://celo.blockscout.com' },
  { chain: 'base', base: 'https://base.blockscout.com' },
  { chain: 'avax', base: 'https://avalanche.blockscout.com' },
]

// En dev (Celo Sepolia) se muestran los movimientos de PRUEBA del mismo wallet
// en los explorers de testnet (las donaciones de Sepolia no existen en mainnet).
const TESTNET_EXPLORERS = [
  { chain: 'celo', base: 'https://celo-sepolia.blockscout.com' },
  { chain: 'base', base: 'https://base-sepolia.blockscout.com' },
]

const addrNameCache = new Map<string, { name: string | null; contract: boolean; at: number }>()

function cacheGet(key: string) {
  const hit = cache.get(key)
  return hit && Date.now() - hit.at < TTL ? hit.value : undefined
}

function poolish(s: string | null | undefined): boolean {
  return !!s && /uni|swap|pool|position|sushiswap|curve/i.test(s)
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function getAddrInfo(base: string, addr: string): Promise<{ name: string | null; contract: boolean }> {
  const key = `${base}|${addr.toLowerCase()}`
  const hit = addrNameCache.get(key)
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return { name: hit.name, contract: hit.contract }
  try {
    const j = await fetchJson(`${base}/api/v2/addresses/${addr}`)
    const out = { name: j?.name || j?.ens_domain_name || null, contract: !!j?.is_contract }
    addrNameCache.set(key, { ...out, at: Date.now() })
    return out
  } catch {
    return { name: null, contract: false }
  }
}

interface Movement {
  chain: string
  ts: string
  hash: string
  direction: 'in' | 'out' | 'self'
  kind: 'native' | 'token'
  token: string | null
  amount: number
  method: string | null
  counterparty: string
  counterpartyName: string | null
  contract: boolean
  tag: 'pool' | 'xaut' | null
}

export async function campaignMovements(
  req?: Request,
  params?: Record<string, string>,
): Promise<Response> {
  const slug = params?.slug || ''
  const cfg = getCampaignConfig(slug)
  if (!cfg) return Response.json({ error: `Unknown campaign: ${slug}` }, { status: 404 })
  const wallet = cfg.wallet
  const url = new URL(req?.url || 'http://localhost')
  const limit = Math.min(300, Number(url.searchParams.get('limit') || '60') || 60)

  // Red: default = la del servidor (mainnet en prod, testnet en dev); override ?network=mainnet|testnet
  const qNetwork = url.searchParams.get('network')
  const isMainnet = qNetwork ? qNetwork === 'mainnet' : process.env.NEXT_PUBLIC_NETWORK === 'celo'
  const EXPLORERS = isMainnet ? MAINNET_EXPLORERS : TESTNET_EXPLORERS
  const network = isMainnet ? 'mainnet' : 'testnet'

  const cacheKey = `mov|${slug}|${limit}`
  const cached = cacheGet(cacheKey)
  if (cached) return Response.json(cached)

  const results = await Promise.allSettled(
    EXPLORERS.map(async (ex) => {
      const txj = await fetchJson(`${ex.base}/api/v2/addresses/${wallet}/transactions`)
      const tokens = await fetchJson(`${ex.base}/api/v2/addresses/${wallet}/token-transfers`)
      return { chain: ex.chain, txj, tokens }
    }),
  )

  const rows: Movement[] = []
  const chains: Array<{ chain: string; available: boolean; error?: string; count: number }> = []

  for (const r of results) {
    if (r.status === 'rejected') {
      chains.push({ chain: '?', available: false, error: String(r.reason).slice(0, 120), count: 0 })
      continue
    }
    const { chain, txj, tokens } = r.value
    const txs = (txj?.items || []).slice(0, 50)
    const tok = (tokens?.items || []).slice(0, 100)
    let count = txs.length + tok.length

    const wl = wallet.toLowerCase()
    for (const t of txs) {
      const from = String(t.from?.hash || '').toLowerCase()
      const to = String(t.to?.hash || '').toLowerCase()
      if (!from && !to) continue
      const direction: Movement['direction'] = from === wl && to === wl ? 'self' : from === wl ? 'out' : 'in'
      const counterparty = direction === 'out' ? to : from
      let counterpartyName: string | null = null
      let contract = false
      if (direction === 'out' && counterparty) {
        const info = await getAddrInfo(EXPLORERS.find((e) => e.chain === chain)?.base || '', counterparty)
        counterpartyName = info.name
        contract = info.contract
      }
      const nativeVal = Number(BigInt(t.value || '0')) / 1e18
      if (nativeVal > 0 || !to) {
        rows.push({
          chain, ts: t.timestamp || '', hash: t.hash || '',
          direction, kind: 'native', token: 'CELO', amount: nativeVal,
          method: t.method || null, counterparty, counterpartyName, contract,
          tag: poolish(counterpartyName) ? 'pool' : null,
        })
      }
    }
    for (const t of tok) {
      const from = String(t.from?.hash || '').toLowerCase()
      const to = String(t.to?.hash || '').toLowerCase()
      if (!from && !to) continue
      const direction: Movement['direction'] = from === wl && to === wl ? 'self' : from === wl ? 'out' : 'in'
      const counterparty = direction === 'out' ? to : from
      let counterpartyName: string | null = null
      let contract = false
      if (direction === 'out' && counterparty) {
        const info = await getAddrInfo(EXPLORERS.find((e) => e.chain === chain)?.base || '', counterparty)
        counterpartyName = info.name
        contract = info.contract
      }
      const dec = Number(t.token?.decimals || 18)
      const amount = Number(BigInt(t.total?.value || '0')) / 10 ** dec
      const symbol = t.token?.symbol || null
      const tag: Movement['tag'] = poolish(counterpartyName) ? 'pool' : /xaut|gold/i.test(symbol || '') ? 'xaut' : null
      rows.push({
        chain, ts: t.timestamp || '', hash: t.transaction_hash || t.tx_hash || '',
        direction, kind: 'token', token: symbol, amount,
        method: t.method || null, counterparty, counterpartyName, contract,
        tag,
      })
    }
    chains.push({ chain, available: true, count })
  }

  rows.sort((a, b) => (a.ts < b.ts ? 1 : -1))
  const sliced = rows.slice(0, limit)
  const body = { slug, network, wallet, chains, rows: sliced, total: rows.length, truncated: rows.length > limit }
  cache.set(cacheKey, { at: Date.now(), value: body })
  return Response.json(body)
}
