'use server'

// REQ/223: transparencia de campañas. Consulta el ledger (subcategoria
// 'campaign') y agrega: total por cripto donada, split campaña/pdJ/cashback en
// USD, pendiente de reenvío y las últimas donaciones con sus opciones.
import { getCampaignConfig, type CampaignConfig } from '../lib/donation-target'
import { round2 } from '../lib/token-prices'
import type { GdclusterDeps } from '../index'

interface RowLike {
  date?: Date
  hash?: string | null
  crypto?: string
  amount?: number
  type?: string
  metadata?: any
}

export interface CampaignTransparencyResponse {
  slug: string
  name: { en: string; es: string }
  wallet: string
  goalUSD: number
  totals: {
    byCrypto: Record<string, number>
    campaignUSD: number
    pdjUSD: number
    cashbackSlearn: number
    pendingUSD: number
  }
  recent: Array<{
    date?: string
    donorHash?: string
    crypto?: string
    amount?: number
    usd?: number
    pdjSharePct?: number
    receiveCashback?: boolean
    forwardOK: boolean
    campaignForwardHash?: string
    pdjForwardHash?: string
  }>
}

export async function campaignTransparency(deps: GdclusterDeps, params?: Record<string, string>): Promise<Response> {
  const slug = params?.slug || ''
  const cfg: CampaignConfig | undefined = getCampaignConfig(slug)
  if (!cfg) {
    return Response.json({ error: `Unknown campaign: ${slug}` }, { status: 404 })
  }

  const db = deps.db()
  const rows = (await db.selectFrom('transaction')
    .select(['date', 'hash', 'crypto', 'amount', 'type', 'metadata'])
    .where('subcategoria', '=', 'campaign')
    .orderBy('date', 'desc')
    .limit(100)
    .execute()) as RowLike[]

  const byCrypto: Record<string, number> = {}
  let campaignUSD = 0
  let pdjUSD = 0
  let cashbackSlearn = 0
  let pendingUSD = 0
  const recent: CampaignTransparencyResponse['recent'] = []

  for (const row of rows) {
    const m = row.metadata as any
    if (!m || m.campaign !== slug) continue

    if (row.type === 'donation_reward') {
      cashbackSlearn = round2(cashbackSlearn + Number(row.amount || 0))
      continue
    }

    // Fila principal de donación
    if (row.crypto) byCrypto[row.crypto] = round2((byCrypto[row.crypto] || 0) + Number(row.amount || 0))
    if (typeof m.campaignAmountUSD === 'number') campaignUSD = round2(campaignUSD + m.campaignAmountUSD)
    if (typeof m.pdjAmountUSD === 'number') pdjUSD = round2(pdjUSD + m.pdjAmountUSD)
    if (m.forwardPending === true || !m.campaignForwardHash) {
      if (typeof m.campaignAmountUSD === 'number') pendingUSD = round2(pendingUSD + m.campaignAmountUSD)
    }

    const pdjRaw = BigInt(m.pdjRaw || '0')
    const forwardOK = !!(m.campaignForwardHash && (pdjRaw <= 0n || m.pdjForwardHash))
    recent.push({
      date: row.date ? new Date(row.date).toISOString() : undefined,
      donorHash: row.hash || undefined,
      crypto: row.crypto,
      amount: Number(row.amount || 0),
      usd: typeof m.campaignAmountUSD === 'number' ? m.campaignAmountUSD : undefined,
      pdjSharePct: m.pdjSharePct,
      receiveCashback: m.receiveCashback,
      forwardOK,
      campaignForwardHash: m.campaignForwardHash,
      pdjForwardHash: m.pdjForwardHash,
    })
  }

  const res: CampaignTransparencyResponse = {
    slug: cfg.slug,
    name: cfg.name,
    wallet: cfg.wallet,
    goalUSD: cfg.goalUSD,
    totals: { byCrypto, campaignUSD, pdjUSD, cashbackSlearn, pendingUSD },
    recent,
  }
  return Response.json(res)
}
