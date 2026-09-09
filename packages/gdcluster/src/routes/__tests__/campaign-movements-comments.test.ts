import { describe, it, expect, vi, afterEach } from 'vitest'
import { attachDonorComments, campaignMovements, invalidateCampaignMovements } from '../campaign-movements'
import { getCampaignConfig } from '../../lib/donation-target'

// REQ/223 — los movimientos de la billetera de la campaña muestran el
// comentario del donante: el ledger guarda el hash del reenvío a la billetera
// de la campaña en metadata.campaignForwardHash (verify), y ese mismo hash
// aparece como transferencia entrante en el explorer.

const HASH = '0x' + 'ab'.repeat(32)
const BACKEND = '0x' + '22'.repeat(20)
const COMMENT = 'Colecta en efectivo iglesia SL'

type Row = any

function row(over: Partial<Row> = {}): Row {
  return {
    chain: 'celo', ts: '2026-09-03T10:00:00Z', hash: HASH, direction: 'in',
    kind: 'token', token: 'USDT', amount: 1, method: null,
    counterparty: BACKEND, counterpartyName: null, contract: false, tag: null,
    ...over,
  }
}

function buildDb(ledgerRows: Row[]) {
  const execute = vi.fn(async () => ledgerRows)
  return {
    db: () => ({
      selectFrom: () => ({
        select: () => ({
          where: () => ({
            where: () => ({ execute }),
          }),
        }),
      }),
    }),
  }
}

const md = (over: any = {}) => ({
  campaign: 'lensenia', network: 'celo', payToken: 'usdt',
  campaignForwardHash: HASH, comment: COMMENT, ...over,
})

describe('attachDonorComments', () => {
  it('adjunta el comentario al movimiento entrante cuyo hash coincide con el reenvío', async () => {
    const deps = buildDb([{ metadata: md() }])
    const out = await attachDonorComments(deps.db(), [row()])
    expect(out[0].comment).toBe(COMMENT)
  })

  it('no adjunta comentarios a salidas, self ni movimientos sin hash', async () => {
    const deps = buildDb([{ metadata: md() }])
    const out = await attachDonorComments(deps.db(), [
      row({ direction: 'out', hash: '0x' + 'cd'.repeat(32) }),
      row({ direction: 'self' }),
      row({ direction: 'in', hash: '' }),
    ])
    expect(out.every((r: Row) => !r.comment)).toBe(true)
  })

  it('ignora filas del ledger sin comentario o sin hash de reenvío', async () => {
    const deps = buildDb([
      { metadata: md({ comment: undefined, campaignForwardHash: undefined }) },
    ])
    const out = await attachDonorComments(deps.db(), [row()])
    expect(out[0].comment).toBeUndefined()
  })

  it('si la BD falla devuelve los movimientos sin enriquecer (no rompe la lista)', async () => {
    const db = {
      selectFrom: () => { throw new Error('db down') },
    }
    const out = await attachDonorComments(db, [row()])
    expect(out[0].comment).toBeUndefined()
  })
})

describe('campaignMovements (GET, con explorer mock)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('expone el comentario del donante en el movimiento entrante del reenvío', async () => {
    const cfg = getCampaignConfig('lensenia')
    if (!cfg) throw new Error('no campaign config lensenia')
    const wallet = cfg.wallet

    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
      const u = String(input)
      if (u.includes('/transactions')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      // token-transfers: solo Celo (mainnet o sepolia) trae el reenvío entrante
      const items = u.includes('celo')
        ? [{
            from: { hash: BACKEND }, to: { hash: wallet },
            total: { value: '1000000' }, transaction_hash: HASH,
            token: { symbol: 'USDT', decimals: 6 },
            timestamp: '2026-09-03T10:00:00Z', method: null,
          }]
        : []
      return new Response(JSON.stringify({ items }), { status: 200 })
    }))

    const deps = buildDb([{ metadata: md() }])
    const res = await campaignMovements(deps as any, new Request('http://x/api/donations/lensenia/movements?limit=30'), { slug: 'lensenia' })
    expect(res.status).toBe(200)
    const json = await res.json()
    const hit = json.rows.find((r: Row) => r.hash === HASH)
    expect(hit).toBeDefined()
    expect(hit.comment).toBe(COMMENT)
    expect(json.rows.every((r: Row) => r.direction !== 'in' || !r.hash || r.hash !== HASH || r.comment)).toBe(true)
  })

  it('no adjunta comentario cuando el ledger no lo tiene (hash desconocido)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
      const u = String(input)
      if (u.includes('/transactions')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      const items = u.includes('celo')
        ? [{
            from: { hash: BACKEND }, to: { hash: getCampaignConfig('lensenia')!.wallet },
            total: { value: '2500000' }, transaction_hash: '0x' + 'ef'.repeat(32),
            token: { symbol: 'USDT', decimals: 6 },
            timestamp: '2026-09-03T11:00:00Z', method: null,
          }]
        : []
      return new Response(JSON.stringify({ items }), { status: 200 })
    }))

    const deps = buildDb([{ metadata: md() }])
    const res = await campaignMovements(deps as any, new Request('http://x/api/donations/lensenia/movements?limit=5'), { slug: 'lensenia' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.rows.find((r: Row) => r.hash === '0x' + 'ef'.repeat(32))?.comment).toBeUndefined()
  })

  it('tras invalidar la caché, el siguiente GET sirve datos frescos (sin esperar el TTL)', async () => {
    const cfg = getCampaignConfig('lensenia')
    if (!cfg) throw new Error('no campaign config lensenia')
    const wallet = cfg.wallet
    const ledger = [{ metadata: md({ comment: 'Primer comentario' }) }]

    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
      const u = String(input)
      if (u.includes('/transactions')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      const items = u.includes('celo')
        ? [{
            from: { hash: BACKEND }, to: { hash: wallet },
            total: { value: '1000000' }, transaction_hash: HASH,
            token: { symbol: 'USDT', decimals: 6 },
            timestamp: '2026-09-03T10:00:00Z', method: null,
          }]
        : []
      return new Response(JSON.stringify({ items }), { status: 200 })
    }))

    const deps = buildDb(ledger)
    const url = 'http://x/api/donations/lensenia/movements?limit=33'
    const first = await campaignMovements(deps as any, new Request(url), { slug: 'lensenia' })
    expect((await first.json()).rows[0].comment).toBe('Primer comentario')

    // Sin invalidación el segundo GET serviría la caché (comentario viejo);
    // tras invalidar, consulta el ledger actualizado.
    ledger[0] = { metadata: md({ comment: 'Comentario actualizado' }) }
    invalidateCampaignMovements('lensenia')
    const second = await campaignMovements(deps as any, new Request(url), { slug: 'lensenia' })
    expect((await second.json()).rows[0].comment).toBe('Comentario actualizado')
  })
})
