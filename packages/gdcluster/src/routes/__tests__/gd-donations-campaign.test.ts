import { describe, it, expect, beforeEach, vi } from 'vitest'
import { encodeFunctionData, type Address } from 'viem'
import { erc20Abi } from '@learn-tg/rewards/lib/donate-utils'
import { verifyCampaignDonation } from '../gd-donations'

// REQ/223 §4.1 — la verificación de donación a campaña reenvía AUTOMÁTICA e
// INMEDIATAMENTE la parte de la campaña a la billetera destino (y la parte
// pdJ a la tesorería), registra el split en el ledger y entrega el cashback
// SLEARN opcional (mint) cuando el donante lo elige. Este archivo cubre el
// flujo en Celo mainnet (la red se detecta por chainId).

const DONOR = '0x1111111111111111111111111111111111111111'
const BACKEND = '0x2222222222222222222222222222222222222222'
const CAMPAIGN_WALLET = '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07'
const TREASURY = '0x3333333333333333333333333333333333333333'
const USDT_TOKEN = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' // Celo mainnet (REQ/223 §8)
const SLEARN_TOKEN = '0x27fd41bea85c39254f2b12789eb37a1543152cc1'
const AMOUNT = 100_000_000n // 100 USDT (6 decimals)

function buildDeps() {
  const calls: any[] = []
  const pub = {
    getBlock: vi.fn(async () => ({ timestamp: BigInt(Math.floor(Date.now() / 1000)) })),
    getTransactionCount: vi.fn(async () => 0),
  }
  const wallet = {
    getAddresses: vi.fn(async () => [BACKEND]),
    chain: { id: 42220 },
  }
  const sendTxAndWait = vi.fn(async (_wallet: any, _pub: any, args: any) => {
    calls.push(args)
    return '0x' + 'ab'.repeat(32)
  })
  const insert = vi.fn(() => ({
    values: vi.fn(() => ({ execute: vi.fn(async () => undefined) })),
  }))
  const db: any = { insertInto: insert }

  const deps: any = {
    db: () => db,
    authenticateUser: vi.fn(async () => ({ usuario: { id: 7 }, billetera: { billetera: DONOR } })),
    backend: {
      getPublicClient: () => pub,
      getWalletClient: () => wallet,
      getBackendWalletLower: () => BACKEND.toLowerCase(),
      sendTxAndWait,
      fetchTxWithReceipt: vi.fn(async () => ({
        receipt: { status: 'success', to: USDT_TOKEN.toLowerCase(), blockNumber: 1n },
        tx: {
          from: DONOR,
          input: encodeFunctionData({
            abi: erc20Abi, functionName: 'transfer',
            args: [BACKEND as Address, AMOUNT],
          }),
        },
      })),
      SLEARN_RATE: 22,
    },
  }
  return { deps, db, insert, sendTxAndWait, calls }
}

const req = (body: Record<string, unknown>) => ({ json: async () => body }) as any
const params = { slug: 'lensenia' }

describe('verifyCampaignDonation', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADDRESS = BACKEND
    process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS = TREASURY
    process.env.NEXT_PUBLIC_USDT_ADDRESS = USDT_TOKEN
    process.env.NEXT_PUBLIC_SLEARN_ADDRESS = SLEARN_TOKEN
  })

  it('rejects unknown campaigns', async () => {
    const { deps } = buildDeps()
    const res = await verifyCampaignDonation(deps, req({}), { slug: 'nope' })
    expect(res.status).toBe(404)
  })

  it('validates pdjSharePct bounds', async () => {
    const { deps } = buildDeps()
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', usdtHash: '0x' + '11'.repeat(32), pdjSharePct: 150,
    }), params)
    expect(res.status).toBe(400)
  })

  it('forwards 100% to the campaign wallet immediately (no cashback, no pdJ)', async () => {
    const { deps, db, sendTxAndWait } = buildDeps()
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', usdtHash: '0x' + '11'.repeat(32),
      receiveCashback: false, pdjSharePct: 0,
    }), params)
    expect(res.status).toBe(200)
    // Reenvío automático e inmediato: un solo transfer a la billetera de la campaña
    expect(sendTxAndWait).toHaveBeenCalledTimes(1)
    expect(sendTxAndWait.mock.calls[0][2].functionName).toBe('transfer')
    expect(sendTxAndWait.mock.calls[0][2].args).toEqual([CAMPAIGN_WALLET, AMOUNT])
    // Ledger: una sola fila `donation` (campaña), sin `donation_reward`
    expect(db.insertInto).toHaveBeenCalledTimes(1)
    const json = await res.json()
    expect(json.increment).toBe(0)
    expect(json.distribution).toEqual([{ destination: 'campaign', amount: 100, crypto: 'usdt' }])
  })

  it('mints cashback first, then forwards campaign + pdJ shares automatically', async () => {
    const { deps, db, sendTxAndWait } = buildDeps()
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', usdtHash: '0x' + '11'.repeat(32),
      receiveCashback: true, pdjSharePct: 10,
    }), params)
    expect(res.status).toBe(200)
    expect(sendTxAndWait).toHaveBeenCalledTimes(3)
    const [mint, campaign, pdj] = sendTxAndWait.mock.calls.map((c) => c[2])
    expect(mint.address.toLowerCase()).toBe(SLEARN_TOKEN.toLowerCase())
    expect(mint.functionName).toBe('mint')
    expect(mint.args).toEqual([DONOR, 22000n]) // 220 SLEARN (2 decimals)
    expect(campaign.args).toEqual([CAMPAIGN_WALLET, 90_000_000n])
    expect(pdj.args).toEqual([TREASURY, 10_000_000n])
    // Ledger: fila donation + fila donation_reward
    expect(db.insertInto).toHaveBeenCalledTimes(2)
    const json = await res.json()
    expect(json.increment).toBe(220)
    expect(json.hashes).toBeDefined()
  })
})

describe('verifyCampaignDonation — auto-forward retries (REQ/223)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADDRESS = BACKEND
    process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS = TREASURY
    process.env.NEXT_PUBLIC_USDT_ADDRESS = USDT_TOKEN
    process.env.NEXT_PUBLIC_SLEARN_ADDRESS = SLEARN_TOKEN
  })

  it('retries once when the forward fails and then succeeds', async () => {
    const { deps, sendTxAndWait } = buildDeps()
    sendTxAndWait.mockRejectedValueOnce(new Error('boom'))
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', usdtHash: '0x' + '11'.repeat(32),
      receiveCashback: false, pdjSharePct: 0,
    }), params)
    expect(res.status).toBe(200)
    expect(sendTxAndWait).toHaveBeenCalledTimes(2)
    const json = await res.json()
    expect(json.pendingForward).toBe(false)
  })

  it('records the donation as pending when the forward keeps failing', async () => {
    const { deps, db, sendTxAndWait } = buildDeps()
    sendTxAndWait.mockRejectedValue(new Error('boom'))
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', usdtHash: '0x' + '22'.repeat(32),
      receiveCashback: false, pdjSharePct: 0,
    }), params)
    expect(res.status).toBe(200)
    expect(sendTxAndWait).toHaveBeenCalledTimes(2)
    const json = await res.json()
    expect(json.pendingForward).toBe(true)
    expect(json.hashes.campaignForwardHash).toBeUndefined()
    // La donación queda registrada (el balance lo muestra como pendiente)
    expect(db.insertInto).toHaveBeenCalledTimes(1)
    const inserted = db.insertInto.mock.results[0].value.values.mock.calls[0][0]
    expect(inserted.metadata.forwardPending).toBe(true)
  })
})
