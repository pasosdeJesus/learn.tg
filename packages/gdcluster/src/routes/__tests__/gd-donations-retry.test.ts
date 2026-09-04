import { describe, it, expect, vi } from 'vitest'
import { retryPendingCampaignForwards } from '../gd-donations'

// REQ/223 §6.1: reintento oportunista de reenvíos pendientes — el balance GET
// vuelve a enviar las filas con metadata.forwardPending y actualiza los hashes.

const BACKEND = '0x2222222222222222222222222222222222222222'
const CAMPAIGN_WALLET = '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07'
const TREASURY = '0x3333333333333333333333333333333333333333'
const USDT_MAIN = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'

const rowMeta = {
  campaign: 'lensenia', network: 'celo', payToken: 'usdt', forwardPending: true,
  campaignForwardHash: undefined, pdjForwardHash: undefined, mintHash: undefined,
  campaignWallet: CAMPAIGN_WALLET, pdjTreasury: TREASURY,
  tokenAddress: USDT_MAIN, tokenDecimals: 6,
  tokenAmountRaw: '10000000', campaignRaw: '9000000', pdjRaw: '1000000',
}

function buildDeps(rows: any[]) {
  let seen: { id: any; payload: any } | null = null
  const db: any = {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => ({ execute: async () => rows }) }),
          }),
        }),
      }),
    }),
    updateTable: vi.fn(() => ({
      set: (payload: any) => ({
        where: (...whereArgs: any[]) => ({
          execute: async () => { seen = { id: whereArgs[2], payload } },
        }),
      }),
    })),
  }
  const pub = { chain: { id: 42220 }, getTransactionCount: vi.fn(async () => 0) }
  const wallet = { getAddresses: vi.fn(async () => [BACKEND]), chain: { id: 42220 } }
  const sendTxAndWait = vi.fn(async () => '0x' + 'fa'.repeat(32))
  const deps: any = {
    db: () => db,
    backend: {
      getPublicClient: () => pub,
      getWalletClient: () => wallet,
      sendTxAndWait,
      getBackendWalletLower: () => BACKEND.toLowerCase(),
    },
  }
  return { deps, db, sendTxAndWait, seen: () => seen }
}

describe('retryPendingCampaignForwards', () => {
  it('re-forwards pending rows and clears forwardPending', async () => {
    const { deps, sendTxAndWait, seen } = buildDeps([{ id: 7, metadata: { ...rowMeta } }])
    const done = await retryPendingCampaignForwards(deps, 'lensenia')
    expect(done).toBe(1)
    expect(sendTxAndWait).toHaveBeenCalledTimes(2)
    const calls = sendTxAndWait.mock.calls.map((c) => c[2])
    expect(calls[0].args).toEqual([CAMPAIGN_WALLET, 9000000n])
    expect(calls[1].args).toEqual([TREASURY, 1000000n])
    const row = seen()!
    expect(Number(row.id)).toBe(7)
    expect(row.payload.metadata.forwardPending).toBe(false)
    expect(row.payload.metadata.campaignForwardHash).toBeTruthy()
    expect(row.payload.metadata.pdjForwardHash).toBeTruthy()
  })

  it('skips rows that are already resolved or belong to another campaign', async () => {
    const { deps, sendTxAndWait } = buildDeps([
      { id: 1, metadata: { ...rowMeta, campaignForwardHash: '0x' + 'aa'.repeat(32), forwardPending: false } },
      { id: 2, metadata: { ...rowMeta, campaign: 'otra' } },
      { id: 3, metadata: { ...rowMeta, network: 'celoSepolia' } },
    ])
    const done = await retryPendingCampaignForwards(deps, 'lensenia')
    expect(done).toBe(0)
    expect(sendTxAndWait).not.toHaveBeenCalled()
  })
})

describe('retryPendingCampaignForwards — CELO nativo', () => {
  it('re-forwards native CELO rows with sendNativeTxAndWait', async () => {
    const rows = [{ id: 9, metadata: { ...rowMeta, payToken: 'celo', tokenAddress: '', campaignRaw: String(2n * 10n ** 18n), pdjRaw: '0', pdjTreasury: TREASURY } }]
    const seen: any = {}
    const db: any = {
      selectFrom: () => ({ select: () => ({ where: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ execute: async () => rows }) }) }) }) }) }),
      updateTable: () => ({ set: (payload: any) => ({ where: (...w: any[]) => ({ execute: async () => { seen.payload = payload } }) }) }),
    }
    const pub = { chain: { id: 42220 }, getTransactionCount: vi.fn(async () => 0) }
    const wallet = { getAddresses: vi.fn(async () => [BACKEND]), chain: { id: 42220 } }
    const sendNativeTxAndWait = vi.fn(async () => '0x' + 'fb'.repeat(32))
    const deps: any = {
      db: () => db,
      backend: {
        getPublicClient: () => pub,
        getWalletClient: () => wallet,
        sendTxAndWait: vi.fn(),
        sendNativeTxAndWait,
        getBackendWalletLower: () => BACKEND.toLowerCase(),
      },
    }
    const done = await retryPendingCampaignForwards(deps, 'lensenia')
    expect(done).toBe(1)
    expect(sendNativeTxAndWait).toHaveBeenCalledTimes(1)
    expect(sendNativeTxAndWait.mock.calls[0][2]).toMatchObject({ to: CAMPAIGN_WALLET, value: 2n * 10n ** 18n })
    expect(seen.payload.metadata.forwardPending).toBe(false)
  })
})
