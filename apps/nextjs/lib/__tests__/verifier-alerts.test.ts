import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getVerifierUserIds,
  raiseVerifierAlert,
  resolveVerifierAlert,
} from '../verifier-alerts'

// REQ/223 — alertas a verificadores para operaciones con la billetera del
// backend como intermediaria: notificación idempotente a todos los
// verificadores y auto-marcado como leída cuando la operación se resuelve.

type Row = Record<string, any>

function fakeDb(opts: {
  users?: Row[]
  existing?: Row[]
  updateRows?: number
  onInsert?: (v: Row) => void
}) {
  const inserts: Row[] = []
  const updates: Row[] = []
  const users = opts.users || []
  const existing = opts.existing || []

  const q = (rows: Row[]) => {
    const self: any = {
      where: () => self,
      limit: () => self,
      execute: async () => rows,
    }
    return self
  }

  const db: any = {
    selectFrom: vi.fn((table: string) => ({
      select: () => (table === 'billetera_usuario' ? q(users) : q(existing)),
    })),
    insertInto: vi.fn((table: string) => ({
      values: (v: Row) => ({
        execute: vi.fn(async () => {
          if (table === 'notifications') {
            inserts.push(v)
            opts.onInsert?.(v)
          }
        }),
      }),
    })),
    updateTable: vi.fn((table: string) => ({
      set: (payload: Row) => {
        updates.push({ table, payload })
        return {
          where: () => ({
            where: () => ({
              execute: vi.fn(async () => ({ numUpdatedRows: BigInt(opts.updateRows ?? 0) })),
            }),
          }),
        }
      },
    })),
  }
  return { db, inserts, updates }
}

describe('getVerifierUserIds', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_VERIFIER_WALLET = '0xAaAa, 0xbbbb,0xAaAa'
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_VERIFIER_WALLET
  })

  it('resuelve las billeteras verificadoras a usuario_id únicos (case-insensitive)', async () => {
    const { db } = fakeDb({ users: [{ usuario_id: 10 }, { usuario_id: 20 }, { usuario_id: 10 }] })
    const ids = await getVerifierUserIds(db)
    expect(ids).toEqual([10, 20])
  })

  it('devuelve [] sin verificadores configurados', async () => {
    delete process.env.NEXT_PUBLIC_VERIFIER_WALLET
    const { db } = fakeDb({ users: [{ usuario_id: 10 }] })
    expect(await getVerifierUserIds(db)).toEqual([])
    expect(db.selectFrom).not.toHaveBeenCalled()
  })
})

describe('raiseVerifierAlert', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_VERIFIER_WALLET = '0xaaaa'
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_VERIFIER_WALLET
  })

  const evt = {
    type: 'funds_forward_pending',
    refKey: 'campaign:lensenia:0x11',
    title: 'Reenvío pendiente / Pending forward',
    content: 'Fondos en la billetera del backend sin reenviar.',
  }

  it('notifica a todos los verificadores (con ref_key y is_read=false)', async () => {
    const { db, inserts } = fakeDb({ users: [{ usuario_id: 10 }, { usuario_id: 20 }] })
    const n = await raiseVerifierAlert(db, evt)
    expect(n).toBe(2)
    expect(inserts).toHaveLength(2)
    for (const row of inserts) {
      expect(row).toMatchObject({
        type: 'funds_forward_pending', ref_key: 'campaign:lensenia:0x11',
        is_read: false,
      })
      expect([10, 20]).toContain(row.usuario_id)
    }
  })

  it('es idempotente por usuario + type + refKey (no spamea en reintentos)', async () => {
    const { db, inserts } = fakeDb({
      users: [{ usuario_id: 10 }],
      existing: [{ id: 1, usuario_id: 10, type: evt.type, ref_key: evt.refKey }],
    })
    const n = await raiseVerifierAlert(db, evt)
    expect(n).toBe(0)
    expect(inserts).toHaveLength(0)
  })

  it('no hace nada sin verificadores configurados', async () => {
    delete process.env.NEXT_PUBLIC_VERIFIER_WALLET
    const { db, inserts } = fakeDb({ users: [{ usuario_id: 10 }] })
    expect(await raiseVerifierAlert(db, evt)).toBe(0)
    expect(inserts).toHaveLength(0)
  })
})

describe('resolveVerifierAlert', () => {
  it('marca como leída para todos los destinatarios de type + refKey', async () => {
    const { db, updates } = fakeDb({ updateRows: 3 })
    const n = await resolveVerifierAlert(db, { type: 'funds_forward_pending', refKey: 'campaign:lensenia:0x11' })
    expect(n).toBe(3)
    expect(updates).toHaveLength(1)
    expect(updates[0].table).toBe('notifications')
    expect(updates[0].payload).toEqual({ is_read: true })
  })
})
