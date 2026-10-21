import { describe, it, expect, afterEach } from 'vitest'
import {
  dequeueSubmission,
  enqueueSubmission,
  listPending,
  pendingCount,
  registerAttempt,
} from '../offline-queue-db'

async function clearQueue() {
  for (const item of await listPending()) await dequeueSubmission(item.id)
}

describe('offline-queue-db (R-#241/R-#242)', () => {
  afterEach(clearQueue)

  it('starts empty', async () => {
    expect(await pendingCount()).toBe(0)
  })

  it('queues a submission with its url and body', async () => {
    await enqueueSubmission('/api/check-crossword', { courseId: 10, guideId: 1 })
    const items = await listPending()
    expect(items).toHaveLength(1)
    expect(items[0].url).toBe('/api/check-crossword')
    expect(items[0].body).toEqual({ courseId: 10, guideId: 1 })
    expect(items[0].attempts).toBe(0)
  })

  it('keeps the order in which the submissions arrived', async () => {
    await enqueueSubmission('/api/check-crossword', { guideId: 1 })
    await new Promise((r) => setTimeout(r, 5))
    await enqueueSubmission('/api/check-crossword', { guideId: 2 })
    const items = await listPending()
    expect(items.map((i) => (i.body as { guideId: number }).guideId)).toEqual([1, 2])
  })

  it('dequeues a submission after it was sent', async () => {
    const record = await enqueueSubmission('/api/check-crossword', { guideId: 3 })
    await dequeueSubmission(record.id)
    expect(await pendingCount()).toBe(0)
  })

  it('counts failed attempts and drops the submission after five', async () => {
    const record = await enqueueSubmission('/api/check-crossword', { guideId: 4 })

    await registerAttempt(record.id)
    expect((await listPending())[0].attempts).toBe(1)

    for (let i = 0; i < 4; i++) await registerAttempt(record.id)
    expect(await pendingCount()).toBe(0)
  })
})
