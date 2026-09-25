import { describe, it, expect, vi } from 'vitest'
import { recordOfflineAnswerNotice, OFFLINE_ANSWER_TYPE } from '../offline-answer-notice'

// R-#242: el resultado de una respuesta guardada sin conexión queda en
// `notifications` (R-#162 fase 1) para que la campana lo muestre aunque el
// estudiante ya no esté en la página del crucigrama cuando la cola se drena.

type Row = Record<string, any>

function fakeDb(existing: Row[] = []) {
  const inserts: Row[] = []
  const db: any = {
    selectFrom: vi.fn(() => {
      const self: any = {
        select: () => self,
        where: () => self,
        limit: () => self,
        execute: async () => existing,
      }
      return self
    }),
    insertInto: vi.fn((table: string) => ({
      values: (v: Row) => ({
        execute: vi.fn(async () => {
          if (table === 'notifications') inserts.push(v)
        }),
      }),
    })),
  }
  return { db, inserts }
}

const SAVED_AT = 1758700000000

describe('recordOfflineAnswerNotice (R-#242)', () => {
  it('stores the result with the scholarship, the link and a stable ref_key', async () => {
    const { db, inserts } = fakeDb()

    const inserted = await recordOfflineAnswerNotice(db, 42, {
      lang: 'en',
      path: '/en/web3-and-ubi/guide1/test',
      scholarshipUsdt: 0.75,
      scholarshipSlearn: 0.75,
      offlineSavedAt: SAVED_AT,
    })

    expect(inserted).toBe(true)
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({
      usuario_id: 42,
      type: OFFLINE_ANSWER_TYPE,
      link: '/en/web3-and-ubi/guide1/test',
      ref_key: `${OFFLINE_ANSWER_TYPE}:${SAVED_AT}`,
      is_read: false,
    })
    expect(inserts[0].content).toContain('0.75 USDT')
    expect(inserts[0].content).toContain('0.75 SLEARN')
    expect(inserts[0].created_at).toBeInstanceOf(Date)
  })

  it('names the words to fix when the answer was not perfect', async () => {
    const { db, inserts } = fakeDb()

    await recordOfflineAnswerNotice(db, 7, {
      lang: 'en',
      mistakesInCW: [3, 5],
      offlineSavedAt: SAVED_AT,
    })

    expect(inserts[0].content).toContain('#3, #5')
    expect(inserts[0].title).toBe('Your saved answer was reviewed')
  })

  it('writes the notice in Spanish when the saved answer was in Spanish', async () => {
    const { db, inserts } = fakeDb()

    await recordOfflineAnswerNotice(db, 7, { lang: 'es', offlineSavedAt: SAVED_AT })

    expect(inserts[0].title).toBe('Tu respuesta guardada fue revisada')
    expect(inserts[0].content).toContain('sin beca nueva')
  })

  it('keeps the server message when there is no new scholarship', async () => {
    const { db, inserts } = fakeDb()

    await recordOfflineAnswerNotice(db, 7, {
      lang: 'en',
      message: 'You are in a waiting period of 24 hours',
      offlineSavedAt: SAVED_AT,
    })

    expect(inserts[0].content).toContain('waiting period of 24 hours')
  })

  it('does not duplicate the notice when the replay runs twice', async () => {
    const { db, inserts } = fakeDb([{ id: 1 }])

    const inserted = await recordOfflineAnswerNotice(db, 7, {
      lang: 'en',
      offlineSavedAt: SAVED_AT,
    })

    expect(inserted).toBe(false)
    expect(inserts).toHaveLength(0)
  })
})
