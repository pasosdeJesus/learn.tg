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

  // R-#242: el hook vive en el layout (`OfflineQueueSync`) y también en la página
  // del crucigrama; dos instancias drenando a la vez enviarían la misma respuesta
  // dos veces (y la beca podría pagarse dos veces).
  it('sends each queued answer only once when two instances flush together', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const first = renderHook(() => useOfflineQueue())
    const second = renderHook(() => useOfflineQueue())
    await act(async () => {
      await first.result.current.enqueue('/api/check-crossword', { guideId: 6 })
    })

    await act(async () => {
      await Promise.all([first.result.current.flush(), second.result.current.flush()])
    })

    expect(fetchMock.mock.calls.filter(([url]: any[]) => url === '/api/check-crossword')).toHaveLength(1)
    expect(await listPending()).toHaveLength(0)
  })

  // R-#242: el contador es un estado de módulo compartido. La instancia que drena
  // la cola puede ser la del layout (`OfflineQueueSync`), no la de la página; con
  // un `useState` por instancia la página seguía mostrando "1 pendiente" con
  // IndexedDB vacío (defecto medido en E2E el 2026-09-24).
  it('shares the pending count between instances when the other one drains', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const page = renderHook(() => useOfflineQueue())
    const layout = renderHook(() => useOfflineQueue())
    await act(async () => {
      await page.result.current.enqueue('/api/check-crossword', { guideId: 7 })
    })
    expect(page.result.current.pending).toBe(1)
    expect(layout.result.current.pending).toBe(1)

    // Drena la instancia del layout, como hace `OfflineQueueSync` al reconectar.
    await act(async () => { await layout.result.current.flush() })

    expect(await listPending()).toHaveLength(0)
    // La instancia de la página lo ve sin volver a pedirlo. Éste es el defecto:
    // antes se quedaba en 1 aunque el store ya estuviera vacío.
    expect(page.result.current.pending).toBe(0)
    expect(layout.result.current.pending).toBe(0)
  })
})
