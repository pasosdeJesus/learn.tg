import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { verifyCampaignDonation } from '../gd-donations'
import { clearPriceCache } from '../../lib/token-prices'

// REQ/223: donaciones de campaña en CELO nativo — el verify lee tx.value del
// receipt (no es ERC-20) y el reenvío usa sendTransaction (to+value) vía
// deps.backend.sendNativeTxAndWait.

const DONOR = '0x1111111111111111111111111111111111111111'
const BACKEND = '0x2222222222222222222222222222222222222222'
const CAMPAIGN_WALLET = '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07'
const TREASURY = '0x3333333333333333333333333333333333333333'
const VALUE = 2n * 10n ** 18n // 2 CELO

function buildDeps(value: bigint) {
  const calls: any[] = []
  const pub = {
    chain: { id: 42220 },
    getTransactionCount: vi.fn(async () => 0),
  }
  const wallet = { getAddresses: vi.fn(async () => [BACKEND]), chain: { id: 42220 } }
  const sendNativeTxAndWait = vi.fn(async (_w: any, _p: any, args: any) => {
    calls.push(args)
    return '0x' + 'ce'.repeat(32)
  })
  const sendTxAndWait = vi.fn(async () => { throw new Error('should not be used for native') })
  const insert = vi.fn(() => ({
    values: vi.fn(() => ({ execute: vi.fn(async () => undefined) })),
  }))
  const db: any = { insertInto: insert }
  const deps: any = {
    db: () => db,
    authenticateUser: vi.fn(async () => ({ usuario: { id: 3 }, billetera: { billetera: DONOR } })),
    backend: {
      getPublicClient: () => pub,
      getWalletClient: () => wallet,
      getBackendWalletLower: () => BACKEND.toLowerCase(),
      sendTxAndWait,
      sendNativeTxAndWait,
      fetchTxWithReceipt: vi.fn(async () => ({
        receipt: { status: 'success', to: BACKEND.toLowerCase() },
        tx: { from: DONOR, value },
      })),
      SLEARN_RATE: 22,
    },
  }
  return { deps, db, calls, sendNativeTxAndWait, sendTxAndWait }
}

const req = (body: Record<string, unknown>) => ({ json: async () => body }) as any
const params = { slug: 'lensenia' }

describe('verifyCampaignDonation — CELO nativo (REQ/223)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADDRESS = BACKEND
    process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS = TREASURY
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ celo: { usd: 0.8 } }),
    })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    clearPriceCache()
  })

  it('forwards 100% of the native CELO to the campaign wallet and records crypto=celo', async () => {
    const { deps, db, calls, sendNativeTxAndWait, sendTxAndWait } = buildDeps(VALUE)
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', payToken: 'celo', usdtHash: '0x' + '11'.repeat(32),
      receiveCashback: false, pdjSharePct: 0,
    }), params)
    expect(res.status).toBe(200)
    expect(sendNativeTxAndWait).toHaveBeenCalledTimes(1)
    expect(sendTxAndWait).not.toHaveBeenCalled()
    expect(calls[0]).toMatchObject({ to: CAMPAIGN_WALLET, value: VALUE })
    expect(db.insertInto).toHaveBeenCalledTimes(1)
    const json = await res.json()
    expect(json.distribution).toEqual([{ destination: 'campaign', amount: 2, crypto: 'celo' }])
    const inserted = db.insertInto.mock.results[0].value.values.mock.calls[0][0]
    expect(inserted.crypto).toBe('celo')
    expect(inserted.metadata.campaignAmountUSD).toBeCloseTo(1.6, 5) // 2 CELO × $0.8
  })

  it('splits campaign/pdJ with two native sends when pdjSharePct > 0', async () => {
    const { deps, calls, sendNativeTxAndWait } = buildDeps(VALUE)
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', payToken: 'celo', usdtHash: '0x' + '22'.repeat(32),
      receiveCashback: false, pdjSharePct: 10,
    }), params)
    expect(res.status).toBe(200)
    expect(sendNativeTxAndWait).toHaveBeenCalledTimes(2)
    expect(calls[0]).toMatchObject({ to: CAMPAIGN_WALLET, value: (VALUE * 90n) / 100n })
    expect(calls[1]).toMatchObject({ to: TREASURY, value: (VALUE * 10n) / 100n })
  })

  it('rejects native transfers not sent to the backend wallet', async () => {
    const { deps, sendNativeTxAndWait } = buildDeps(VALUE)
    deps.backend.fetchTxWithReceipt = vi.fn(async () => ({
      receipt: { status: 'success', to: CAMPAIGN_WALLET.toLowerCase() },
      tx: { from: DONOR, value: VALUE },
    }))
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', payToken: 'celo', usdtHash: '0x' + '33'.repeat(32),
    }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('not sent to the backend wallet')
    expect(sendNativeTxAndWait).not.toHaveBeenCalled()
  })
})
