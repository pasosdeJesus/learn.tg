import { createPublicClient, http, type Address } from 'viem'
import { celo, avalanche, base } from 'viem/chains'
import { erc20Abi } from '@learn-tg/rewards/lib/donate-utils'
import { getCampaignConfig } from '../lib/donation-target'
import { getTokenUsdPrice, round2 } from '../lib/token-prices'
import { retryPendingCampaignForwards } from './gd-donations'
import type { GdclusterDeps } from '../index'

/**
 * Balance multi-cadena de una campaña (REQ/223 §4.1 — presentación):
 * lee los saldos on-chain REALES de la billetera destino en Celo, AVAX y Base
 * (incluye ahorros previos de la billetera, no solo recaudación de la
 * campaña). El ledger (`transaction`, subcategoria='campaign') aporta el
 * "pendiente de reenvío" (reenvío automático fallido/en cola).
 *
 * Rutas RPC configurables: RPC_URL_CELO / RPC_URL_AVAX / RPC_URL_BASE.
 */

const V_CHAIN = { celo, avax: avalanche, base }
/**
 * Rutas RPC configurables por cadena (mismo patrón Alchemy que
 * NEXT_PUBLIC_RPC_URL): NEXT_PUBLIC_CELO_RPC_URL / NEXT_PUBLIC_AVAX_RPC_URL /
 * NEXT_PUBLIC_BASE_RPC_URL. Sin override se usan los RPC públicos del
 * registro (rpcDefault).
 */
const RPC_ENV: Record<string, string> = {
  celo: 'NEXT_PUBLIC_CELO_RPC_URL',
  avax: 'NEXT_PUBLIC_AVAX_RPC_URL',
  base: 'NEXT_PUBLIC_BASE_RPC_URL',
}

export interface CampaignBalanceEntry {
  key: string
  symbol: string
  amount: number
  decimals: number
  usd: number | null
}

export interface CampaignBalanceChain {
  chain: string
  chainId: number
  available: boolean
  error?: string
  native?: CampaignBalanceEntry | null
  tokens: CampaignBalanceEntry[]
  totalUSD: number | null
}

export interface CampaignBalanceResponse {
  slug: string
  name: { en: string; es: string }
  wallet: string
  goalUSD: number
  totalUSD: number | null
  pendingUSD: number
  chains: CampaignBalanceChain[]
  updatedAt: string
}

export async function campaignBalance(deps: GdclusterDeps, params?: Record<string, string>): Promise<Response> {
  const slug = params?.slug || ''
  const cfg = getCampaignConfig(slug)
  if (!cfg) {
    return Response.json({ error: `Unknown campaign: ${slug}` }, { status: 404 })
  }

  // Reintento oportunista (fire-and-forget): el próximo visitante de la página
  // reintenta los reenvíos pendientes sin necesidad de un scheduler (REQ/223 §6.1).
  void retryPendingCampaignForwards(deps, slug).catch((e: any) => {
    console.error('[CampaignBalance] retry pending forwards failed:', e?.message || e)
  })

  const chains: CampaignBalanceChain[] = await Promise.all(cfg.chains.map(async (chainCfg): Promise<CampaignBalanceChain> => {
    const chainEntry: CampaignBalanceChain = {
      chain: chainCfg.chain,
      chainId: chainCfg.chainId,
      available: true,
      native: null,
      tokens: [],
      totalUSD: null,
    }
    try {
      const rpcUrl = process.env[RPC_ENV[chainCfg.chain]] || chainCfg.rpcDefault
      const client = createPublicClient({ chain: V_CHAIN[chainCfg.chain], transport: http(rpcUrl, { timeout: 15_000 }) })

      const readToken = async (tk: { key: string; symbol: string; address: string; decimals: number; native?: boolean; peggedUsd?: boolean; coingeckoId?: string }): Promise<CampaignBalanceEntry> => {
        const raw = tk.native
          ? await client.getBalance({ address: cfg.wallet as Address })
          : await client.readContract({ address: tk.address as Address, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.wallet as Address] })
        const amount = Number(raw) / 10 ** tk.decimals
        let usd: number | null = null
        try {
          const price = await getTokenUsdPrice({ key: tk.key, peggedUsd: tk.peggedUsd, coingeckoId: tk.coingeckoId })
          usd = round2(amount * price)
        } catch {
          usd = null // token sin precio disponible → no suma al total
        }
        return { key: tk.key, symbol: tk.symbol, amount: round2(amount), decimals: tk.decimals, usd }
      }

      if (chainCfg.nativeToken) {
        chainEntry.native = await readToken({ ...chainCfg.nativeToken, address: '' })
      }
      chainEntry.tokens = await Promise.all(chainCfg.tokens.map(readToken))

      const sum = (e: CampaignBalanceEntry | null | undefined) => (e && e.usd != null ? e.usd : 0)
      const total = chainEntry.tokens.reduce((acc, t) => acc + sum(t), sum(chainEntry.native))
      chainEntry.totalUSD = round2(total)
    } catch (e: any) {
      chainEntry.available = false
      chainEntry.error = e?.message || String(e)
    }
    return chainEntry
  }))

  const sumChain = (c: CampaignBalanceChain) => (c.available && c.totalUSD != null ? c.totalUSD : 0)
  const totalUSD = round2(chains.reduce((acc, c) => acc + sumChain(c), 0))

  // Pendiente de reenvío desde el ledger (transparencia + interín de fallos).
  let pendingUSD = 0
  try {
    const db = deps.db()
    const rows = await db.selectFrom('transaction')
      .select(['metadata'])
      .where('type', '=', 'donation')
      .where('subcategoria', '=', 'campaign')
      .execute()
    for (const row of rows) {
      const meta = row.metadata as any
      if (!meta || meta.campaign !== slug) continue
      if (!meta.campaignForwardHash && typeof meta.campaignAmountUSD === 'number') {
        pendingUSD += meta.campaignAmountUSD
      }
    }
    pendingUSD = round2(pendingUSD)
  } catch {
    pendingUSD = 0 // ledger no disponible (p. ej. sin DB) → no bloquea la presentación
  }

  const res: CampaignBalanceResponse = {
    slug: cfg.slug,
    name: cfg.name,
    wallet: cfg.wallet,
    goalUSD: cfg.goalUSD,
    totalUSD,
    pendingUSD,
    chains,
    updatedAt: new Date().toISOString(),
  }
  return Response.json(res)
}
