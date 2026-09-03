import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { encodeFunctionData, type Address } from 'viem'
import { erc20Abi } from '@learn-tg/rewards/lib/donate-utils'
import { verifyCampaignDonation } from '../gd-donations'
import { clearPriceCache } from '../../lib/token-prices'

// REQ/223: recepción multi-token en mainnet (Celo 42220). USDC es estable
// (pegged, sin fetch); XAUt0 se cotiza por CoinGecko (tether-gold). Las filas
// del ledger usan `transaction.crypto` = 'usdc'/'xaut0' (migración
// 20260903120000).

const DONOR = '0x1111111111111111111111111111111111111111'
const BACKEND = '0x2222222222222222222222222222222222222222'
const CAMPAIGN_WALLET = '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07'
const USDC_MAINNET = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
const XAUT0_MAINNET = '0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff'

function buildDeps(tokenAddr: string, amount: bigint) {
  const pub = {
    chain: { id: 42220 },
    getBlock: vi.fn(async () => ({ timestamp: BigInt(Math.floor(Date.now() / 1000)) })),
    getTransactionCount: vi.fn(async () => 0),
  }
  const wallet = { getAddresses: vi.fn(async () => [BACKEND]), chain: { id: 42220 } }
  const sendTxAndWait = vi.fn(async () => '0x' + 'ef'.repeat(32))
  const insert = vi.fn(() => ({
    values: vi.fn(() => ({ execute: vi.fn(async () => undefined) })),
  }))
  const db: any = { insertInto: insert }
  const deps: any = {
    db: () => db,
    authenticateUser: vi.fn(async () => ({ usuario: { id: 12 }, billetera: { billetera: DONOR } })),
    backend: {
      getPublicClient: () => pub,
      getWalletClient: () => wallet,
      getBackendWalletLower: () => BACKEND.toLowerCase(),
      sendTxAndWait,
      fetchTxWithReceipt: vi.fn(async () => ({
        receipt: { status: 'success', to: tokenAddr.toLowerCase(), blockNumber: 1n },
        tx: {
          from: DONOR,
          input: encodeFunctionData({
            abi: erc20Abi, functionName: 'transfer',
            args: [BACKEND as Address, amount],
          }),
        },
      })),
      SLEARN_RATE: 22,
    },
  }
  return { deps, db, sendTxAndWait }
}

const req = (body: Record<string, unknown>) => ({ json: async () => body }) as any
const params = { slug: 'lensenia' }

describe('verifyCampaignDonation — multi-token mainnet (REQ/223)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADDRESS = BACKEND
    process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS = BACKEND
    delete process.env.NEXT_PUBLIC_USDT_ADDRESS
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    clearPriceCache()
  })

  it('accepts USDC (pegged) and forwards 100% in USDC units', async () => {
    const amount = 5_000_000n // 5 USDC
    const { deps, db, sendTxAndWait } = buildDeps(USDC_MAINNET, amount)
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', payToken: 'usdc', usdtHash: '0x' + '11'.repeat(32),
      receiveCashback: false, pdjSharePct: 0,
    }), params)
    expect(res.status).toBe(200)
    expect(sendTxAndWait).toHaveBeenCalledTimes(1)
    const tx = sendTxAndWait.mock.calls[0][2]
    expect(tx.address.toLowerCase()).toBe(USDC_MAINNET.toLowerCase())
    expect(tx.args).toEqual([CAMPAIGN_WALLET, amount])
    expect(db.insertInto).toHaveBeenCalledTimes(1)
    const json = await res.json()
    expect(json.distribution).toEqual([{ destination: 'campaign', amount: 5, crypto: 'usdc' }])
    expect(json.increment).toBe(0)
  })

  it('accepts XAUt0 (priced via CoinGecko) and forwards raw units', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ 'tether-gold': { usd: 4000 } }),
    })))
    const amount = 2_000_000n // 2 XAUt0 (6 decimals)
    const { deps, db, sendTxAndWait } = buildDeps(XAUT0_MAINNET, amount)
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', payToken: 'xaut0', usdtHash: '0x' + '22'.repeat(32),
      receiveCashback: false, pdjSharePct: 0,
    }), params)
    expect(res.status).toBe(200)
    expect(sendTxAndWait).toHaveBeenCalledTimes(1)
    const tx = sendTxAndWait.mock.calls[0][2]
    expect(tx.address.toLowerCase()).toBe(XAUT0_MAINNET.toLowerCase())
    expect(tx.args).toEqual([CAMPAIGN_WALLET, amount])
    expect(db.insertInto).toHaveBeenCalledTimes(1)
    const json = await res.json()
    // distribution en unidades del token (2 XAUt0), metadata en USD (8000)
    expect(json.distribution).toEqual([{ destination: 'campaign', amount: 2, crypto: 'xaut0' }])
    const inserted = db.insertInto.mock.results[0].value.values.mock.calls[0][0]
    expect(inserted.crypto).toBe('xaut0')
    expect(inserted.metadata.campaignAmountUSD).toBe(8000)
    expect(inserted.amount).toBe(2)
  })

  it('returns 400 when the XAUt0 price cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    const { deps, db, sendTxAndWait } = buildDeps(XAUT0_MAINNET, 1_000_000n)
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', payToken: 'xaut0', usdtHash: '0x' + '33'.repeat(32),
    }), params)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('USD price unavailable')
    expect(sendTxAndWait).not.toHaveBeenCalled()
    expect(db.insertInto).not.toHaveBeenCalled()
  })
})
