import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOfflineQueue } from '../useOfflineQueue'
import { dequeueSubmission, listPending } from '@/lib/offline-queue-db'

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

async function clearQueue() {
  for (const item of await listPending()) await dequeueSubmission(item.id)
}

describe('useOfflineQueue (R-#241/R-#242)', () => {
  beforeEach(async () => {
    setOnLine(true)
    await clearQueue()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })))
  })

  afterEach(async () => {
    await clearQueue()
    setOnLine(true)
    vi.unstubAllGlobals()
  })

  it('queues an answer and reports how many are waiting', async () => {
    const { result } = renderHook(() => useOfflineQueue())
    await act(async () => {
      await result.current.enqueue('/api/check-crossword', { guideId: 1 })
    })
    expect(result.current.pending).toBe(1)
  })

  it('sends the queued answers and empties the queue', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useOfflineQueue())
    await act(async () => {
      await result.current.enqueue('/api/check-crossword', { guideId: 2 })
    })

    let sent = 0
    await act(async () => { sent = await result.current.flush() })

    expect(sent).toBe(1)
    expect(result.current.pending).toBe(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/check-crossword', expect.objectContaining({ method: 'POST' }))
  })

  it('keeps the answer queued when the server fails (500)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))

    const { result } = renderHook(() => useOfflineQueue())
    await act(async () => {
      await result.current.enqueue('/api/check-crossword', { guideId: 3 })
    })
    await act(async () => { await result.current.flush() })

    expect(result.current.pending).toBe(1)
  })

  it('keeps the answer queued when there is no network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Failed to fetch') }))

    const { result } = renderHook(() => useOfflineQueue())
    await act(async () => {
      await result.current.enqueue('/api/check-crossword', { guideId: 4 })
    })
    await act(async () => { await result.current.flush() })

    expect(result.current.pending).toBe(1)
  })

  it('does not try to send while the browser is offline', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    setOnLine(false)

    const { result } = renderHook(() => useOfflineQueue())
    await act(async () => {
      await result.current.enqueue('/api/check-crossword', { guideId: 5 })
    })
    let sent = 0
    await act(async () => { sent = await result.current.flush() })

    expect(sent).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.pending).toBe(1)
  })
})
