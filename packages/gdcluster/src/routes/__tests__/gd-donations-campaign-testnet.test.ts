import { describe, it, expect, beforeEach, vi } from 'vitest'
import { encodeFunctionData, type Address } from 'viem'
import { erc20Abi } from '@learn-tg/rewards/lib/donate-utils'
import { verifyCampaignDonation } from '../gd-donations'

// REQ/223 + testnet: el flujo de donación a campaña es consciente de red.
// En Celo Sepolia (chainId 11142220) se usan los tokens de `cfg.testnet`
// (hoy solo USDT Mock, 0x7d7a…) y se reenvía a la misma billetera destino.

const DONOR = '0x1111111111111111111111111111111111111111'
const BACKEND = '0x2222222222222222222222222222222222222222'
const CAMPAIGN_WALLET = '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07'
const USDT_SEPOLIA = '0x7d7a73c8c0D00Fdf8b54b1a6dB6eBDEcdBa78aE8' // MockUSDT (apps/.env.example)
const AMOUNT = 5_000_000n // 5 USDT (6 decimals)

function buildDeps() {
  const calls: any[] = []
  const pub = {
    chain: { id: 11142220 },
    getBlock: vi.fn(async () => ({ timestamp: BigInt(Math.floor(Date.now() / 1000)) })),
    getTransactionCount: vi.fn(async () => 0),
  }
  const wallet = { getAddresses: vi.fn(async () => [BACKEND]), chain: { id: 11142220 } }
  const sendTxAndWait = vi.fn(async (_wallet: any, _pub: any, args: any) => {
    calls.push(args)
    return '0x' + 'cd'.repeat(32)
  })
  const insert = vi.fn(() => ({
    values: vi.fn(() => ({ execute: vi.fn(async () => undefined) })),
  }))
  const db: any = { insertInto: insert }
  const deps: any = {
    db: () => db,
    authenticateUser: vi.fn(async () => ({ usuario: { id: 9 }, billetera: { billetera: DONOR } })),
    backend: {
      getPublicClient: () => pub,
      getWalletClient: () => wallet,
      getBackendWalletLower: () => BACKEND.toLowerCase(),
      sendTxAndWait,
      fetchTxWithReceipt: vi.fn(async () => ({
        receipt: { status: 'success', to: USDT_SEPOLIA.toLowerCase(), blockNumber: 1n },
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
  return { deps, db, sendTxAndWait, calls }
}

const req = (body: Record<string, unknown>) => ({ json: async () => body }) as any
const params = { slug: 'lensenia' }

describe('verifyCampaignDonation (Celo Sepolia)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADDRESS = BACKEND
    process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS = BACKEND
  })

  it('forwards the whole test donation to the campaign wallet (no cashback)', async () => {
    const { deps, db, sendTxAndWait } = buildDeps()
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', usdtHash: '0x' + '11'.repeat(32),
      receiveCashback: false, pdjSharePct: 0,
    }), params)
    expect(res.status).toBe(200)
    expect(sendTxAndWait).toHaveBeenCalledTimes(1)
    const tx = sendTxAndWait.mock.calls[0][2]
    expect(tx.address.toLowerCase()).toBe(USDT_SEPOLIA.toLowerCase())
    expect(tx.args).toEqual([CAMPAIGN_WALLET, AMOUNT])
    expect(db.insertInto).toHaveBeenCalledTimes(1)
    const json = await res.json()
    expect(json.tokenAmount).toBe(String(AMOUNT))
    expect(json.increment).toBe(0)
  })

  it('rejects USDC on testnet (solo USDT por ahora)', async () => {
    const { deps } = buildDeps()
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', payToken: 'usdc', usdtHash: '0x' + '11'.repeat(32),
    }), params)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('usdc')
    expect(json.error).toContain('Allowed: usdt')
  })

  it('rejects unsupported networks', async () => {
    const { deps } = buildDeps()
    deps.backend.getPublicClient = () => ({ chain: { id: 999 } })
    const res = await verifyCampaignDonation(deps, req({
      walletAddress: DONOR, token: 'tok', usdtHash: '0x' + '11'.repeat(32),
    }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Unsupported network')
  })
})
