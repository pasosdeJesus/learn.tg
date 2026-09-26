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

  // Opción A de https://github.com/pasosdeJesus/learn.tg/issues/234 §4.9: si el servidor no
  // reconoce la sesión (401/403) la respuesta **no** se descarta ni gasta intentos. Antes
  // `registerAttempt` la borraba a los 5 intentos, y el estudiante perdía su trabajo por
  // estar sin red más que la vida de la sesión.
  it('keeps the answer and asks to sign in again when the session is gone (401)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      clone: () => ({ json: async () => ({ error: 'Unauthorized' }) }),
    })))

    const { result } = renderHook(() => useOfflineQueue())
    await act(async () => {
      await result.current.enqueue('/api/check-crossword', { guideId: 6 })
    })
    // Más intentos que `MAX_ATTEMPTS` (5): con el comportamiento anterior la respuesta ya
    // se habría descartado.
    for (let attempt = 0; attempt < 7; attempt++) {
      await act(async () => { await result.current.flush() })
    }

    expect(result.current.pending).toBe(1)
    expect(result.current.lastRejection?.needsSignIn).toBe(true)
    expect(result.current.lastRejection?.status).toBe(401)
  })

  // El candado de módulo (`activeFlush`) es por pestaña: con dos pestañas abiertas las dos
  // drenaban la misma respuesta guardada (medido en el E2E de dos cursos contra el sitio de
  // desarrollo, 2026-09-25: la segunda entrega recibía el enfriamiento de 24 h porque la
  // primera ya había pagado). `navigator.locks` lo cubre entre pestañas.
  it('does not send anything when another tab holds the drain lock', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    // `ifAvailable: true` con el candado tomado: el callback recibe `null`.
    vi.stubGlobal('navigator', {
      ...window.navigator,
      onLine: true,
      locks: {
        request: vi.fn(async (_name: string, _opts: unknown, cb: (lock: unknown) => Promise<unknown>) => cb(null)),
      },
    })

    const { result } = renderHook(() => useOfflineQueue())
    await act(async () => {
      await result.current.enqueue('/api/check-crossword', { guideId: 5 })
    })
    let sent = -1
    await act(async () => { sent = await result.current.flush() })

    expect(sent).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
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
