import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCourse } from '../useCourse'
import { getDownloadedCourse } from '@/lib/offline-course-db'

vi.mock('@/lib/offline-course-db', () => ({
  courseKey: (lang: string, prefix: string) => `${lang}/${prefix}`,
  getDownloadedCourse: vi.fn(),
}))

const authedApi = vi.hoisted(() => ({ useAuthedApi: vi.fn() }))
vi.mock('@/lib/hooks/useAuthedApi', () => ({ useAuthedApi: authedApi.useAuthedApi }))

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

/** Registro descargado de un curso (R-#256): todas las guías y el idioma. */
const downloadedCourse = {
  key: 'en/web3-and-ubi',
  courseId: 7,
  lang: 'en',
  prefix: 'web3-and-ubi',
  titulo: 'Web3 and UBI',
  subtitulo: 'Your guide to collecting UBI',
  resumenMd: '<p>Introducción del curso</p>',
  contenidoSensible: false,
  isPremium: false,
  wallet: null,
  downloadedAt: Date.now(),
  revision: 'r1',
  guides: [
    { suffix: 'guide1', titulo: 'What is a cluster?', puzzle: null, completed: true, receivedScholarship: true },
    { suffix: 'guide4', puzzle: null },
  ],
  bytes: 1024,
}

describe('useCourse offline (R-#256)', () => {
  const authedGet = vi.fn()

  beforeEach(() => {
    authedGet.mockReset()
    authedApi.useAuthedApi.mockReturnValue({
      wallet: null,
      ready: true,
      mismatch: false,
      authedGet,
    })
    vi.mocked(getDownloadedCourse).mockReset()
  })

  afterEach(() => {
    setOnLine(true)
  })

  it('builds the course from the downloaded record without touching the network', async () => {
    setOnLine(false)
    vi.mocked(getDownloadedCourse).mockResolvedValue(downloadedCourse as never)

    const { result } = renderHook(() => useCourse({ lang: 'en', pathPrefix: 'web3-and-ubi' }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.course?.id).toBe('7')
    // Todas las guías descargadas, no solo la visitada: sin eso la página de una
    // guía nunca abierta en línea no encuentra su número de guía.
    expect(result.current.course?.guias?.map((guide) => guide.sufijoRuta)).toEqual([
      'guide1',
      'guide4',
    ])
    // R-#256 §3.10: presentación y avance del momento de la descarga.
    expect(result.current.fromDevice).toBe(true)
    expect(result.current.downloadedAt).toBe(downloadedCourse.downloadedAt)
    // Las páginas deciden si el curso es legible con `Number(course.porPagar) <= 0` y el
    // catálogo devuelve `null` en los gratuitos (`Number(null)` es 0). Con `undefined`
    // eso es `NaN`, y sin conexión la página del curso se veía sin derecho a leerlo y
    // escondía la copia descargada (E2E 2026-09-25: el avance guardado no aparecía).
    expect(Number(result.current.course?.porPagar)).toBe(0)
    expect(Number.isNaN(Number(result.current.course?.porPagar))).toBe(false)
    expect(result.current.course?.subtitulo).toBe('Your guide to collecting UBI')
    expect(result.current.course?.resumenMd).toBe('<p>Introducción del curso</p>')
    expect(result.current.course?.guias?.[0]).toMatchObject({
      sufijoRuta: 'guide1',
      completed: true,
      receivedScholarship: true,
    })
    // El título guardado con la copia, no el sufijo de ruta: sin conexión el índice
    // mostraba `guide1` (operador, 2026-09-25). Una copia sin título cae al sufijo.
    expect(result.current.course?.guias?.map((guide) => guide.titulo)).toEqual([
      'What is a cluster?',
      'guide4',
    ])
    expect(authedGet).not.toHaveBeenCalled()
  })

  it('reports an error offline when the course was never downloaded', async () => {
    setOnLine(false)
    vi.mocked(getDownloadedCourse).mockResolvedValue(null)

    const { result } = renderHook(() => useCourse({ lang: 'en', pathPrefix: 'web3-and-ubi' }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.course).toBeNull()
    expect(result.current.error).toBeTruthy()
    expect(authedGet).not.toHaveBeenCalled()
  })

  it('falls back to the downloaded record when the online request fails', async () => {
    setOnLine(true)
    authedGet.mockRejectedValue(new Error('Failed to fetch'))
    vi.mocked(getDownloadedCourse).mockResolvedValue(downloadedCourse as never)

    const { result } = renderHook(() => useCourse({ lang: 'en', pathPrefix: 'web3-and-ubi' }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(authedGet).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
    expect(result.current.course?.guias).toHaveLength(2)
    // La copia del dispositivo se marca como tal para que la página diga que el
    // avance y las acciones son los de la descarga (§3.10).
    expect(result.current.fromDevice).toBe(true)
  })

  // Regresión medida en E2E el 2026-09-24: al pasar a sin conexión con el curso ya
  // cargado, el hook volvía a correr y lo borraba (el crucigrama perdía la
  // cuadrícula y el botón de envío quedaba deshabilitado).
  it('does not drop the course already on screen when the device goes offline', async () => {
    setOnLine(true)
    authedGet
      .mockResolvedValueOnce({ data: [{ id: 7 }] })
      .mockResolvedValueOnce({
        data: { id: 7, guias: [{ titulo: 'guide1', sufijoRuta: 'guide1' }] },
      })
    vi.mocked(getDownloadedCourse).mockResolvedValue(null)

    const { result, rerender } = renderHook(() =>
      useCourse({ lang: 'en', pathPrefix: 'web3-and-ubi' }),
    )
    await waitFor(() => expect(String(result.current.course?.id)).toBe('7'))

    setOnLine(false)
    rerender()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(String(result.current.course?.id)).toBe('7')
    expect(result.current.error).toBeNull()
    // Sin copia descargada y sin conexión no se pierde lo que ya está en pantalla.
    expect(vi.mocked(getDownloadedCourse)).not.toHaveBeenCalled()
  })
})
