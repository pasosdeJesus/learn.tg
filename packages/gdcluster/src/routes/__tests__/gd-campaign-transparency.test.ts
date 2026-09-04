import { describe, it, expect } from 'vitest'
import { campaignTransparency } from '../gd-campaign-transparency'

// REQ/223: el dashboard de transparencia agrega el ledger de campaña
// (totales por cripto, split campaña/pdJ/cashback, pendiente) y últimas filas.

function buildDb(rows: any[]) {
  return {
    db: () => ({
      selectFrom: () => ({
        select: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => ({ execute: async () => rows }) }),
          }),
        }),
      }),
    }),
  }
}

const meta = (over: any) => ({
  campaign: 'lensenia', network: 'celo', payToken: 'usdt', forwardPending: false,
  campaignForwardHash: '0x' + 'aa'.repeat(32), pdjForwardHash: undefined, mintHash: undefined,
  pdjRaw: '0', tokenAddress: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
  ...over,
})

describe('campaignTransparency', () => {
  it('aggregates totals and lists donation rows', async () => {
    const rows = [
      { date: new Date('2026-09-03T10:00:00Z'), hash: '0x' + '11'.repeat(32), crypto: 'usdt', amount: 5, type: 'donation',
        metadata: meta({ campaignAmountUSD: 5, pdjAmountUSD: 0, pdjSharePct: 0, receiveCashback: false }) },
      { date: new Date('2026-09-03T11:00:00Z'), hash: '0x' + '22'.repeat(32), crypto: 'usdt', amount: 2, type: 'donation',
        metadata: meta({ campaignAmountUSD: 1.8, pdjAmountUSD: 0.2, pdjSharePct: 10, receiveCashback: true, pdjForwardHash: '0x' + 'bb'.repeat(32), pdjRaw: '200000' }) },
      { date: new Date('2026-09-03T12:00:00Z'), hash: '0x' + '33'.repeat(32), crypto: 'usdt', amount: 3, type: 'donation',
        metadata: meta({ campaignAmountUSD: 3, pdjAmountUSD: 0, pdjSharePct: 0, receiveCashback: false, forwardPending: true, campaignForwardHash: undefined }) },
      { date: new Date('2026-09-03T11:00:00Z'), hash: '0x' + '44'.repeat(32), crypto: 'slearn', amount: 4.4, type: 'donation_reward',
        metadata: { campaign: 'lensenia', destination: 'cashback' } },
    ]
    const deps: any = buildDb(rows)
    const res = await campaignTransparency(deps, { slug: 'lensenia' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totals.byCrypto).toEqual({ usdt: 10 })
    expect(json.totals.campaignUSD).toBeCloseTo(9.8, 5)
    expect(json.totals.pdjUSD).toBeCloseTo(0.2, 5)
    expect(json.totals.cashbackSlearn).toBeCloseTo(4.4, 5)
    expect(json.totals.pendingUSD).toBeCloseTo(3, 5)
    expect(json.recent).toHaveLength(3)
    expect(json.recent.find((d: any) => d.usd === 3)?.forwardOK).toBe(false)
    expect(json.recent.find((d: any) => d.usd === 5)?.forwardOK).toBe(true)
  })

  it('returns 404 for unknown campaigns', async () => {
    const deps: any = buildDb([])
    const res = await campaignTransparency(deps, { slug: 'nope' })
    expect(res.status).toBe(404)
  })
})
